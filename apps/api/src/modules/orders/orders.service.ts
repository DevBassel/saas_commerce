import {
  BadRequestException,
  ForbiddenException,
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
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { R2Service } from '../../common/storage/r2.service';
import { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Address } from '../addresses/entities/address.entity';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import StripePaymentService from '../payments/stripe.payment.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatus } from './constants/order-status.enum';
import { OrderPermissionKey } from './constants/order-permissions.enum';
import {
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_PREFIX,
  ORDER_NUMBER_SUFFIX_LENGTH,
} from './constants/order.constants';
import { SerializedOrder } from './constants/orders.interface';
import { CheckoutDto } from './dto/checkout.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import {
  refundOrderIfPaid,
  restockOrderItems,
  serializeOrder,
} from './orders.helpers';

type Requester = RequestWithUser['user'];

const round2 = (value: number): number => Math.round(value * 100) / 100;

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

@Injectable()
export class OrdersService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly r2: R2Service,
    private readonly payments: StripePaymentService,
  ) {}

  private resolveTenant(tenant?: TenantRef): TenantRef {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context required');
    return target;
  }

  private async repos(tenant?: TenantRef): Promise<{
    target: TenantRef;
    orderRepo: Repository<Order>;
  }> {
    const target = this.resolveTenant(tenant);
    const orderRepo = await this.tenantManager.getRepository(Order, target);
    return { target, orderRepo };
  }

  async checkout(
    userId: number,
    dto: CheckoutDto = {},
    tenant?: TenantRef,
  ): Promise<SerializedOrder> {
    const { orderRepo } = await this.repos(tenant);

    const order = await this.withUniqueRetry(() =>
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
            if (!product) {
              throw new BadRequestException(
                `Product ${item.productId} is no longer available`,
              );
            }
            if (!product.isActive) {
              throw new BadRequestException(
                `Product ${product.sku} is not available`,
              );
            }
            if (product.stock < item.quantity) {
              throw new BadRequestException(
                `Insufficient stock for ${product.sku}`,
              );
            }

            const unitPrice = product.price;
            const lineTotal = round2(unitPrice * item.quantity);
            subtotal = round2(subtotal + lineTotal);

            const image = this.primaryImage(product.images);
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

          const savedOrder = await orders.save(
            orders.create({
              orderNumber: this.generateOrderNumber(),
              userId,
              status: OrderStatus.PENDING,
              paymentStatus: PaymentStatus.UNPAID,
              subtotal,
              total: subtotal,
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

          const savedItems = await orderLines.save(
            snapshots.map((snapshot) =>
              orderLines.create({ ...snapshot, orderId: savedOrder.id }),
            ),
          );

          for (const item of ordered) {
            const product = productsById.get(item.productId);
            if (!product) continue;
            await products.update(
              { id: product.id },
              { stock: product.stock - item.quantity },
            );
          }

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
  ): Promise<SerializedOrder[]> {
    const { orderRepo } = await this.repos(tenant);

    const where: FindOptionsWhere<Order> = {};
    if (this.canManage(requester)) {
      if (query.status) where.status = query.status;
      if (query.userId != null) where.userId = query.userId;
    } else {
      where.userId = requester.id;
    }

    const orders = await orderRepo.find({
      where,
      relations: { items: true, user: true },
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => serializeOrder(order, this.r2));
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

  private primaryImage(images?: ProductImage[]): ProductImage | undefined {
    if (!images || images.length === 0) return undefined;
    return images.reduce((best, image) => {
      if (image.position < best.position) return image;
      if (image.position === best.position && image.id < best.id) return image;
      return best;
    });
  }

  private async withUniqueRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      return operation();
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const code =
      (error as { code?: string } | null)?.code ??
      (error as { driverError?: { code?: string } } | null)?.driverError?.code;
    return code === '23505';
  }
}
