import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { withUniqueRetry } from '../../common/db/unique-retry';
import { round2 } from '../../common/utils/money';
import { R2Service } from '../../common/storage/r2.service';
import { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { Product } from '../products/entities/product.entity';
import { primaryImage } from '../products/utils/product-image.util';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Address } from '../addresses/entities/address.entity';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import StripePaymentService from '../payments/stripe.payment.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatus } from './constants/order-status.enum';
import { OrderPermissionKey } from './constants/order-permissions.enum';
import { CouponsService } from '../coupons/coupons.service';
import { CouponApplication } from '../coupons/constants/coupons.interface';
import {
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_PREFIX,
  ORDER_NUMBER_SUFFIX_LENGTH,
} from './constants/order.constants';
import { SerializedOrder } from './constants/orders.interface';
import { CheckoutDto } from './dto/checkout.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import {
  PaginatedResult,
  isPaginatedQuery,
  resolvePagination,
  resolveSort,
} from '../../common/pagination/pagination';
import {
  refundOrderIfPaid,
  restockOrderItems,
  serializeOrder,
} from './orders.helpers';

type Requester = RequestWithUser['user'];

const OWNER_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

const MANAGER_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
]);

const ORDER_SORTABLE_FIELDS: readonly (keyof Order)[] = [
  'orderNumber',
  'status',
  'paymentStatus',
  'subtotal',
  'total',
  'discountAmount',
  'userId',
  'paidAt',
  'refundedAt',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly r2: R2Service,
    private readonly payments: StripePaymentService,
    private readonly coupons: CouponsService,
  ) {}

  private async repos(tenant?: TenantRef): Promise<{
    target: TenantRef;
    orderRepo: Repository<Order>;
  }> {
    const target = resolveTenantScope(tenant);
    const orderRepo = await this.tenantManager.getRepository(Order, target);
    return { target, orderRepo };
  }

  async checkout(
    userId: number,
    dto: CheckoutDto = {},
    tenant?: TenantRef,
  ): Promise<SerializedOrder> {
    const { orderRepo } = await this.repos(tenant);

    const order = await withUniqueRetry(() =>
      orderRepo.manager.transaction(
        async (manager: EntityManager): Promise<Order> => {
          const carts = manager.getRepository(Cart);
          const cartItems = manager.getRepository(CartItem);
          const products = manager.getRepository(Product);
          const orders = manager.getRepository(Order);
          const orderLines = manager.getRepository(OrderItem);
          const addresses = manager.getRepository(Address);

          const cart = await carts.findOne({
            where: { userId },
            relations: { items: true },
          });

          const items = cart?.items ?? [];
          if (!cart || items.length === 0) {
            throw new BadRequestException('Cart is empty');
          }

          const ordered = items.slice().sort((a, b) => a.id - b.id);
          const productIds = [
            ...new Set(ordered.map((item) => item.productId)),
          ];
          // lock row for hande users checkout in same time
          const lockedProducts = await products
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.images', 'image')
            .where('product.id IN (:...ids)', { ids: productIds })
            .setLock('pessimistic_write', undefined, ['product'])
            .getMany();
          const productsById = new Map(
            lockedProducts.map((product) => [product.id, product]),
          );

          const snapshots: DeepPartial<OrderItem>[] = [];
          let subtotal = 0;
          for (const item of ordered) {
            const product = productsById.get(item.productId);
            if (!product)
              throw new BadRequestException(
                `Product ${item.productId} is no longer available`,
              );

            if (!product.isActive)
              throw new BadRequestException(`${product.sku} is not available`);

            if (product.stock < item.quantity)
              throw new BadRequestException(
                `Insufficient stock for ${product.sku}`,
              );

            const unitPrice = product.price;
            const lineTotal = round2(unitPrice * item.quantity);
            subtotal = round2(subtotal + lineTotal);

            const image = primaryImage(product.images);
            snapshots.push({
              productId: product.id,
              name: product.name,
              sku: product.sku,
              unitPrice,
              quantity: item.quantity,
              lineTotal,
              imageObjectKey: image?.objectKey ?? null,
            });
          }

          const deliveryAddress = await this.resolveDeliveryAddress(
            addresses,
            userId,
            dto.addressId,
          );

          let couponApplication: CouponApplication | null = null;
          if (dto.couponCode != null) {
            couponApplication = await this.coupons.validateAndConsume(manager, {
              code: dto.couponCode,
              userId,
              subtotal,
            });
          }
          const discountAmount = couponApplication?.discountAmount ?? 0;
          const total = round2(subtotal - discountAmount);

          const savedOrder = await orders.save(
            orders.create({
              orderNumber: this.generateOrderNumber(),
              userId,
              status: OrderStatus.PENDING,
              paymentStatus: PaymentStatus.UNPAID,
              subtotal,
              total,
              discountAmount,
              couponId: couponApplication?.couponId ?? null,
              couponCode: couponApplication?.snapshot.couponCode ?? null,
              couponDiscountType:
                couponApplication?.snapshot.couponDiscountType ?? null,
              couponDiscountValue:
                couponApplication?.snapshot.couponDiscountValue ?? null,
              addressId: deliveryAddress.id,
              recipientName: deliveryAddress.recipientName,
              phone: deliveryAddress.phone,
              line1: deliveryAddress.line1,
              line2: deliveryAddress.line2 ?? null,
              city: deliveryAddress.city,
              state: deliveryAddress.state ?? null,
              postalCode: deliveryAddress.postalCode,
              country: deliveryAddress.country,
            }),
          );

          if (couponApplication) {
            await this.coupons.consume(manager, {
              couponId: couponApplication.couponId,
              orderId: savedOrder.id,
              userId,
              discountAmount: couponApplication.discountAmount,
            });
          }

          const lineRows = snapshots.map((snapshot) =>
            orderLines.create({ ...snapshot, orderId: savedOrder.id }),
          );
          const { identifiers } = await orderLines.insert(lineRows);
          const generatedIds = identifiers as { id: number }[];
          const savedItems = lineRows.map((row, index) => ({
            ...row,
            id: generatedIds[index]?.id ?? row.id,
          }));

          const stockCases = ordered
            .map((_, index) => `WHEN :pid_${index} THEN :qty_${index}`)
            .join(' ');
          const stockParams: Record<string, number> = {};
          ordered.forEach((item, index) => {
            stockParams[`pid_${index}`] = item.productId;
            stockParams[`qty_${index}`] = item.quantity;
          });

          // Single UPDATE ... CASE instead of one UPDATE per line.
          await manager
            .createQueryBuilder()
            .update(Product)
            .set({
              stock: () => `"stock" - CASE "id" ${stockCases} ELSE 0 END`,
            })
            .whereInIds(productIds)
            .setParameters(stockParams)
            .execute();

          await cartItems.delete({ cartId: cart.id });

          return { ...savedOrder, items: savedItems } as Order;
        },
      ),
    );

    return serializeOrder(order, this.r2);
  }

  async findAll(
    requester: Requester,
    query: ListOrdersQueryDto = {},
    tenant?: TenantRef,
  ): Promise<SerializedOrder[] | PaginatedResult<SerializedOrder>> {
    const { orderRepo } = await this.repos(tenant);

    const where: FindOptionsWhere<Order> = {};
    if (this.canManage(requester)) {
      if (query.status) where.status = query.status;
      if (query.userId != null) where.userId = query.userId;
    } else {
      where.userId = requester.id;
    }

    if (!isPaginatedQuery(query)) {
      const orders = await orderRepo.find({
        where,
        relations: { items: true, user: true },
        order: { createdAt: 'DESC' },
      });
      return orders.map((order) => serializeOrder(order, this.r2));
    }

    const { page, limit, skip, take } = resolvePagination(query);
    const order = resolveSort<Order>(
      query.sortBy,
      query.sortOrder,
      ORDER_SORTABLE_FIELDS,
      { field: 'createdAt', order: 'desc' },
    );

    const [orders, total] = await orderRepo.findAndCount({
      where,
      relations: { items: true, user: true },
      order,
      skip,
      take,
      relationLoadStrategy: 'query',
    });
    return {
      data: orders.map((row) => serializeOrder(row, this.r2)),
      total,
      page,
      limit,
    };
  }

  async findOne(
    id: number,
    requester: Requester,
    tenant?: TenantRef,
  ): Promise<SerializedOrder> {
    const { orderRepo } = await this.repos(tenant);

    const order = await orderRepo.findOne({
      where: { id },
      relations: { items: true, user: true },
    });
    if (
      !order ||
      (!this.canManage(requester) && order.userId !== requester.id)
    ) {
      throw new NotFoundException('Order not found');
    }
    return serializeOrder(order, this.r2);
  }

  async cancel(
    id: number,
    requester: Requester,
    tenant?: TenantRef,
  ): Promise<SerializedOrder> {
    const { target, orderRepo } = await this.repos(tenant);
    const manage = this.canManage(requester);

    const order = await orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order || (!manage && order.userId !== requester.id)) {
      throw new NotFoundException('Order not found');
    }

    const cancellable = manage
      ? MANAGER_CANCELLABLE_STATUSES.has(order.status)
      : OWNER_CANCELLABLE_STATUSES.has(order.status);
    if (!cancellable) {
      throw new BadRequestException(
        `Order cannot be cancelled from ${order.status}`,
      );
    }

    // Stripe must not run inside the DB transaction. Refund first, so a paid
    // order is never cancelled without the customer's money coming back.
    const refundedAt = await refundOrderIfPaid(order, target, this.payments);

    await orderRepo.manager.transaction(async (manager: EntityManager) => {
      const orders = manager.getRepository(Order);
      await orders.update(
        { id },
        {
          status: OrderStatus.CANCELLED,
          ...(refundedAt
            ? { paymentStatus: PaymentStatus.REFUNDED, refundedAt }
            : {}),
        },
      );
      await restockOrderItems(manager, order.items ?? []);
      await this.coupons.restoreUsage(manager, order);
    });

    return this.findOne(id, requester, target);
  }

  async requestReturn(
    id: number,
    requester: Requester,
    tenant?: TenantRef,
  ): Promise<SerializedOrder> {
    const { target, orderRepo } = await this.repos(tenant);
    const manage = this.canManage(requester);

    await orderRepo.manager.transaction(async (manager: EntityManager) => {
      const orders = manager.getRepository(Order);
      const order = await orders.findOne({
        where: { id },
        relations: { items: true },
      });
      if (!order || (!manage && order.userId !== requester.id)) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.DELIVERED) {
        throw new BadRequestException(
          'Return can only be requested for a delivered order',
        );
      }

      await orders.update({ id }, { status: OrderStatus.RETURN_REQUESTED });
    });

    return this.findOne(id, requester, target);
  }

  private async resolveDeliveryAddress(
    addresses: Repository<Address>,
    userId: number,
    addressId?: number,
  ): Promise<Address> {
    if (addressId != null) {
      const address = await addresses.findOne({
        where: { id: addressId, userId },
      });
      if (!address) {
        throw new BadRequestException('Delivery address not found');
      }
      return address;
    }

    const address = await addresses.findOne({
      where: { userId, isDefault: true },
    });
    if (!address) {
      throw new BadRequestException('Delivery address required');
    }
    return address;
  }

  private canManage(requester: Requester): boolean {
    return requester.permissions?.includes(OrderPermissionKey.MANAGE) ?? false;
  }

  private generateOrderNumber(now: Date = new Date()): string {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    let suffix = '';
    for (let i = 0; i < ORDER_NUMBER_SUFFIX_LENGTH; i++) {
      suffix +=
        ORDER_NUMBER_ALPHABET[
          Math.floor(Math.random() * ORDER_NUMBER_ALPHABET.length)
        ];
    }

    return `${ORDER_NUMBER_PREFIX}-${year}${month}${day}-${suffix}`;
  }
}
