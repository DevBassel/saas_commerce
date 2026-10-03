import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { isUniqueViolation } from '../../common/db/unique-retry';
import { round2 } from '../../common/utils/money';
import { CartService } from '../cart/cart.service';
import { Order } from '../orders/entities/order.entity';
import { DiscountType } from './constants/discount-type.enum';
import {
  COUPON_CODE_MESSAGE,
  COUPON_CODE_REGEX,
  MAX_COUPON_CODE_LENGTH,
  normalizeCouponCode,
} from './constants/coupon.constants';
import {
  CouponApplication,
  SerializedCoupon,
  SerializedCouponValidation,
} from './constants/coupons.interface';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ListCouponsQueryDto } from './dto/list-coupons.query.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Coupon } from './entities/coupon.entity';
import { CouponRedemption } from './entities/coupon-redemption.entity';
import { computeDiscount } from './utils/coupon-discount';
import { serializeCoupon } from './utils/coupons.serializer';
import {
  PaginatedResult,
  resolvePagination,
  resolveSort,
} from '../../common/pagination/pagination';

interface CouponRulesInput {
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
}

const COUPON_SORTABLE_FIELDS: readonly (keyof Coupon)[] = [
  'code',
  'description',
  'discountType',
  'discountValue',
  'minOrderAmount',
  'maxDiscountAmount',
  'usageLimit',
  'perUserLimit',
  'usageCount',
  'startsAt',
  'expiresAt',
  'isActive',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class CouponsService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly cartService: CartService,
  ) {}

  private async repos(tenant?: TenantRef): Promise<{
    target: TenantRef;
    couponRepo: Repository<Coupon>;
    redemptionRepo: Repository<CouponRedemption>;
  }> {
    const target = resolveTenantScope(tenant);
    const [couponRepo, redemptionRepo] = await Promise.all([
      this.tenantManager.getRepository(Coupon, target),
      this.tenantManager.getRepository(CouponRedemption, target),
    ]);
    return { target, couponRepo, redemptionRepo };
  }

  async create(
    dto: CreateCouponDto,
    tenant?: TenantRef,
  ): Promise<SerializedCoupon> {
    const { couponRepo } = await this.repos(tenant);

    const code = normalizeCouponCode(dto.code);
    this.assertCodeValid(code);
    this.assertRules(dto);
    this.assertDateRange(this.toDate(dto.startsAt), this.toDate(dto.expiresAt));

    const existing = await couponRepo.findOneBy({ code });
    if (existing) throw new BadRequestException('Coupon code already exists');

    let saved: Coupon;
    try {
      saved = await couponRepo.save(
        couponRepo.create({
          code,
          description: dto.description ?? null,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          minOrderAmount: dto.minOrderAmount ?? 0,
          maxDiscountAmount: dto.maxDiscountAmount ?? null,
          usageLimit: dto.usageLimit ?? null,
          perUserLimit: dto.perUserLimit ?? null,
          startsAt: this.toDate(dto.startsAt),
          expiresAt: this.toDate(dto.expiresAt),
          isActive: dto.isActive ?? true,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('Coupon code already exists');
      }
      throw error;
    }

    return serializeCoupon(saved);
  }

  async findAll(
    query: ListCouponsQueryDto = {},
    tenant?: TenantRef,
  ): Promise<PaginatedResult<SerializedCoupon>> {
    const { couponRepo } = await this.repos(tenant);

    const where: FindOptionsWhere<Coupon> = {};
    if (query.isActive != null) where.isActive = query.isActive;
    if (query.code) where.code = normalizeCouponCode(query.code);

    const { page, limit, skip, take } = resolvePagination(query);
    const order = resolveSort<Coupon>(
      query.sortBy,
      query.sortOrder,
      COUPON_SORTABLE_FIELDS,
      { field: 'createdAt', order: 'desc' },
    );

    const [coupons, total] = await couponRepo.findAndCount({
      where,
      order,
      skip,
      take,
    });
    return { data: coupons.map(serializeCoupon), total, page, limit };
  }

  async findOne(id: number, tenant?: TenantRef): Promise<SerializedCoupon> {
    const { couponRepo } = await this.repos(tenant);
    const coupon = await couponRepo.findOneBy({ id });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return serializeCoupon(coupon);
  }

  async update(
    id: number,
    dto: UpdateCouponDto,
    tenant?: TenantRef,
  ): Promise<SerializedCoupon> {
    const { couponRepo } = await this.repos(tenant);

    const coupon = await couponRepo.findOneBy({ id });
    if (!coupon) throw new NotFoundException('Coupon not found');

    let code = coupon.code;
    if (dto.code != null) {
      code = normalizeCouponCode(dto.code);
      this.assertCodeValid(code);
      if (code !== coupon.code) {
        if (coupon.usageCount > 0) {
          throw new BadRequestException(
            'Cannot change the code of a redeemed coupon',
          );
        }
        const existing = await couponRepo.findOneBy({ code });
        if (existing && existing.id !== id) {
          throw new BadRequestException('Coupon code already exists');
        }
      }
    }

    const merged: CouponRulesInput = {
      discountType: dto.discountType ?? coupon.discountType,
      discountValue: dto.discountValue ?? coupon.discountValue,
      maxDiscountAmount:
        dto.maxDiscountAmount !== undefined
          ? dto.maxDiscountAmount
          : coupon.maxDiscountAmount,
    };
    this.assertRules(merged);

    const startsAt =
      dto.startsAt !== undefined ? this.toDate(dto.startsAt) : coupon.startsAt;
    const expiresAt =
      dto.expiresAt !== undefined
        ? this.toDate(dto.expiresAt)
        : coupon.expiresAt;
    this.assertDateRange(startsAt, expiresAt);

    const patch: Partial<Coupon> = {};
    if (dto.code != null) patch.code = code;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.discountType !== undefined) patch.discountType = dto.discountType;
    if (dto.discountValue !== undefined)
      patch.discountValue = dto.discountValue;
    if (dto.minOrderAmount !== undefined)
      patch.minOrderAmount = dto.minOrderAmount;
    if (dto.maxDiscountAmount !== undefined)
      patch.maxDiscountAmount = dto.maxDiscountAmount;
    if (dto.usageLimit !== undefined) patch.usageLimit = dto.usageLimit;
    if (dto.perUserLimit !== undefined) patch.perUserLimit = dto.perUserLimit;
    if (dto.startsAt !== undefined) patch.startsAt = startsAt;
    if (dto.expiresAt !== undefined) patch.expiresAt = expiresAt;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    if (Object.keys(patch).length > 0) {
      try {
        await couponRepo.update({ id }, patch);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new BadRequestException('Coupon code already exists');
        }
        throw error;
      }
    }

    return this.findOne(id, tenant);
  }

  async setStatus(
    id: number,
    isActive: boolean,
    tenant?: TenantRef,
  ): Promise<SerializedCoupon> {
    const { couponRepo } = await this.repos(tenant);
    const coupon = await couponRepo.findOneBy({ id });
    if (!coupon) throw new NotFoundException('Coupon not found');

    await couponRepo.update({ id }, { isActive });
    return this.findOne(id, tenant);
  }

  async remove(id: number, tenant?: TenantRef): Promise<{ deleted: true }> {
    const { couponRepo } = await this.repos(tenant);
    const coupon = await couponRepo.findOneBy({ id });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.usageCount > 0) {
      throw new ConflictException(
        'Coupon has redemptions; deactivate it instead',
      );
    }

    await couponRepo.delete({ id });
    return { deleted: true };
  }

  /**
   * Server-side preview for the authenticated customer: computes the discount
   * against the caller's current cart subtotal without consuming usage.
   */
  async validate(
    code: string,
    userId: number,
    tenant?: TenantRef,
  ): Promise<SerializedCouponValidation> {
    const { target, couponRepo, redemptionRepo } = await this.repos(tenant);

    const normalized = normalizeCouponCode(code);
    this.assertCodeValid(normalized);

    const coupon = await couponRepo.findOneBy({ code: normalized });
    if (!coupon) throw new BadRequestException('Coupon not found');

    const { subtotal } = await this.cartService.getCart(userId, target);
    await this.assertRedeemable(coupon, redemptionRepo, userId, subtotal);

    const { discountAmount } = computeDiscount(coupon, subtotal);
    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      subtotal,
      discountAmount,
      total: round2(subtotal - discountAmount),
    };
  }

  /**
   * Checkout entry point. Runs inside the caller's transaction, locks the
   * coupon row (`pessimistic_write`) and re-reads the usage limits after the
   * lock, so concurrent redemptions of the same coupon serialize. It validates
   * and computes the discount but does not write usage: the redemption can only
   * be recorded once the order id exists (see {@link consume}).
   */
  async validateAndConsume(
    manager: EntityManager,
    params: { code: string; userId: number; subtotal: number },
  ): Promise<CouponApplication> {
    const normalized = normalizeCouponCode(params.code);
    this.assertCodeValid(normalized);

    const couponRepo = manager.getRepository(Coupon);
    const redemptionRepo = manager.getRepository(CouponRedemption);

    const coupon = await couponRepo
      .createQueryBuilder('coupon')
      .where('coupon.code = :code', { code: normalized })
      .setLock('pessimistic_write', undefined, ['coupon'])
      .getOne();
    if (!coupon) throw new BadRequestException('Coupon not found');

    await this.assertRedeemable(
      coupon,
      redemptionRepo,
      params.userId,
      params.subtotal,
    );

    const { discountAmount } = computeDiscount(coupon, params.subtotal);
    return {
      couponId: coupon.id,
      discountAmount,
      snapshot: {
        couponId: coupon.id,
        couponCode: coupon.code,
        couponDiscountType: coupon.discountType,
        couponDiscountValue: coupon.discountValue,
      },
    };
  }

  /**
   * Records the redemption after the order row exists, inside the same
   * transaction as {@link validateAndConsume}. A thrown error rolls both back.
   */
  async consume(
    manager: EntityManager,
    params: {
      couponId: number;
      orderId: number;
      userId: number;
      discountAmount: number;
    },
  ): Promise<void> {
    const couponRepo = manager.getRepository(Coupon);
    const redemptionRepo = manager.getRepository(CouponRedemption);

    await couponRepo.increment({ id: params.couponId }, 'usageCount', 1);
    await redemptionRepo.insert(
      redemptionRepo.create({
        couponId: params.couponId,
        orderId: params.orderId,
        userId: params.userId,
        discountAmount: params.discountAmount,
      }),
    );
  }

  /**
   * Restores coupon usage when an order is fully reversed (cancelled or
   * returned) inside the caller's transaction. The redemption row is the
   * idempotency marker: deleting it and decrementing the guarded counter is a
   * no-op when the order never used a coupon or was already restored.
   */
  async restoreUsage(manager: EntityManager, order: Order): Promise<void> {
    if (order.couponId == null) return;

    const couponRepo = manager.getRepository(Coupon);
    const redemptionRepo = manager.getRepository(CouponRedemption);

    const deleted = await redemptionRepo.delete({
      orderId: order.id,
      couponId: order.couponId,
    });
    if (!deleted.affected) return;

    await couponRepo
      .createQueryBuilder()
      .update(Coupon)
      .set({ usageCount: () => '"usageCount" - 1' })
      .where('id = :id', { id: order.couponId })
      .andWhere('"usageCount" > 0')
      .execute();
  }

  private async assertRedeemable(
    coupon: Coupon,
    redemptionRepo: Repository<CouponRedemption>,
    userId: number,
    subtotal: number,
  ): Promise<void> {
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon has expired');
    }

    if (subtotal < coupon.minOrderAmount) {
      throw new BadRequestException(
        'Order does not meet the minimum amount for this coupon',
      );
    }

    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.perUserLimit != null) {
      const used = await redemptionRepo.count({
        where: { couponId: coupon.id, userId },
      });
      if (used >= coupon.perUserLimit) {
        throw new BadRequestException('Coupon already used');
      }
    }
  }

  private assertCodeValid(code: string): void {
    if (
      !code ||
      code.length > MAX_COUPON_CODE_LENGTH ||
      !COUPON_CODE_REGEX.test(code)
    ) {
      throw new BadRequestException(`Coupon code ${COUPON_CODE_MESSAGE}`);
    }
  }

  private assertRules(input: CouponRulesInput): void {
    if (input.discountType === DiscountType.PERCENTAGE) {
      if (input.discountValue <= 0 || input.discountValue > 100) {
        throw new BadRequestException('Invalid discount value');
      }
    } else if (input.discountValue <= 0) {
      throw new BadRequestException('Invalid discount value');
    }

    if (
      input.discountType === DiscountType.FIXED_AMOUNT &&
      input.maxDiscountAmount != null
    ) {
      throw new BadRequestException(
        'maxDiscountAmount is only supported for percentage coupons',
      );
    }
  }

  private assertDateRange(
    startsAt?: Date | null,
    expiresAt?: Date | null,
  ): void {
    if (startsAt && expiresAt && startsAt.getTime() >= expiresAt.getTime()) {
      throw new BadRequestException('startsAt must be before expiresAt');
    }
  }

  private toDate(value?: string | null): Date | null {
    if (value == null) return null;
    return new Date(value);
  }
}
