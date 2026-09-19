import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { TenantManagerService } from '../tenants/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { R2Service } from '../../common/storage/r2.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import {
  MAX_CART_ITEMS,
  MAX_CART_ITEM_QUANTITY,
} from './constants/cart.constants';
import { SerializedCart, SerializedCartItem } from './constants/cart.interface';

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class CartService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly r2: R2Service,
  ) {}

  private resolveTenant(tenant?: TenantRef): TenantRef {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context required');
    return target;
  }

  private async repos(tenant?: TenantRef): Promise<{
    cartRepo: Repository<Cart>;
    itemRepo: Repository<CartItem>;
    productRepo: Repository<Product>;
  }> {
    const target = this.resolveTenant(tenant);
    const [cartRepo, itemRepo, productRepo] = await Promise.all([
      this.tenantManager.getRepository(Cart, target),
      this.tenantManager.getRepository(CartItem, target),
      this.tenantManager.getRepository(Product, target),
    ]);
    return { cartRepo, itemRepo, productRepo };
  }

  async getCart(userId: number, tenant?: TenantRef): Promise<SerializedCart> {
    const { cartRepo, productRepo } = await this.repos(tenant);

    const cart = await cartRepo.findOne({
      where: { userId },
      relations: { items: true },
    });
    if (!cart) return this.emptyCart(userId);

    const items = (cart.items ?? []).slice().sort((a, b) => a.id - b.id);
    const productIds = [...new Set(items.map((item) => item.productId))];

    const products =
      productIds.length > 0
        ? await productRepo.find({
            where: { id: In(productIds) },
            relations: { images: true },
          })
        : [];
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    const serialized: SerializedCartItem[] = [];
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) continue;

      const image = this.primaryImage(product.images);
      const unitPrice = product.price;
      serialized.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice,
        quantity: item.quantity,
        lineTotal: round2(unitPrice * item.quantity),
        isActive: product.isActive,
        isAvailable: product.isActive && product.stock >= item.quantity,
        availableStock: product.stock,
        imageUrl: image ? this.r2.publicUrl(image.objectKey) : null,
      });
    }

    return {
      id: cart.id,
      userId: cart.userId,
      items: serialized,
      subtotal: round2(
        serialized.reduce((sum, item) => sum + item.lineTotal, 0),
      ),
      totalItems: serialized.length,
      totalQuantity: serialized.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  async addItem(
    userId: number,
    dto: AddCartItemDto,
    tenant?: TenantRef,
  ): Promise<SerializedCart> {
    const target = this.resolveTenant(tenant);
    const { cartRepo, productRepo } = await this.repos(target);

    const product = await productRepo.findOneBy({ id: dto.productId });
    if (!product) throw new BadRequestException('Product not found');
    if (!product.isActive)
      throw new BadRequestException('Product is not available');
    if (product.stock <= 0)
      throw new BadRequestException('Product is out of stock');

    const quantity = dto.quantity ?? 1;

    await this.withUniqueRetry(() =>
      cartRepo.manager.transaction(async (manager) => {
        const carts = manager.getRepository(Cart);
        const items = manager.getRepository(CartItem);

        const cart = await this.findOrCreateCart(carts, userId);
        const existing = await items.findOne({
          where: { cartId: cart.id, productId: product.id },
        });

        if (!existing) {
          const count = await items.count({ where: { cartId: cart.id } });
          if (count >= MAX_CART_ITEMS) {
            throw new BadRequestException(
              `Cart cannot contain more than ${MAX_CART_ITEMS} items`,
            );
          }
        }

        const nextQuantity = (existing?.quantity ?? 0) + quantity;
        this.assertQuantityWithinLimits(nextQuantity, product.stock);

        if (existing) {
          await items.update({ id: existing.id }, { quantity: nextQuantity });
        } else {
          await items.save(
            items.create({
              cartId: cart.id,
              productId: product.id,
              quantity: nextQuantity,
            }),
          );
        }
      }),
    );

    return this.getCart(userId, target);
  }

  async updateItem(
    userId: number,
    productId: number,
    dto: UpdateCartItemDto,
    tenant?: TenantRef,
  ): Promise<SerializedCart> {
    const target = this.resolveTenant(tenant);
    const { cartRepo, itemRepo, productRepo } = await this.repos(target);

    const cart = await cartRepo.findOne({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart item not found');
    const item = await itemRepo.findOne({
      where: { cartId: cart.id, productId },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    const product = await productRepo.findOneBy({ id: productId });
    if (!product) throw new BadRequestException('Product not found');

    if (dto.quantity > item.quantity) {
      if (!product.isActive) {
        throw new BadRequestException('Product is not available');
      }
      this.assertQuantityWithinLimits(dto.quantity, product.stock);
    }

    await itemRepo.update({ id: item.id }, { quantity: dto.quantity });
    return this.getCart(userId, target);
  }

  async removeItem(
    userId: number,
    productId: number,
    tenant?: TenantRef,
  ): Promise<SerializedCart> {
    const target = this.resolveTenant(tenant);
    const { cartRepo, itemRepo } = await this.repos(target);

    const cart = await cartRepo.findOne({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart item not found');
    const item = await itemRepo.findOne({
      where: { cartId: cart.id, productId },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await itemRepo.delete({ id: item.id });
    return this.getCart(userId, target);
  }

  async clearCart(userId: number, tenant?: TenantRef): Promise<SerializedCart> {
    const target = this.resolveTenant(tenant);
    const { cartRepo, itemRepo } = await this.repos(target);

    const cart = await cartRepo.findOne({ where: { userId } });
    if (!cart) return this.emptyCart(userId);

    await itemRepo.delete({ cartId: cart.id });
    return this.getCart(userId, target);
  }

  private emptyCart(userId: number): SerializedCart {
    return {
      id: null,
      userId,
      items: [],
      subtotal: 0,
      totalItems: 0,
      totalQuantity: 0,
      createdAt: null,
      updatedAt: null,
    };
  }

  private async findOrCreateCart(
    carts: Repository<Cart>,
    userId: number,
  ): Promise<Cart> {
    const existing = await carts.findOne({ where: { userId } });
    if (existing) return existing;
    return carts.save(carts.create({ userId }));
  }

  private assertQuantityWithinLimits(quantity: number, stock: number): void {
    if (quantity > MAX_CART_ITEM_QUANTITY) {
      throw new BadRequestException('Quantity exceeds maximum');
    }
    if (quantity > stock) {
      throw new BadRequestException('Insufficient stock');
    }
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
