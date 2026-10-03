import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Order } from '../../orders/entities/order.entity';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { DiscountType } from '../constants/discount-type.enum';
import {
  TENANT,
  buildCouponMocks,
  couponEntity,
  createDto,
} from './coupons.spec-helpers';

const asCreateDto = (overrides: Record<string, unknown> = {}) =>
  createDto(overrides) as unknown as CreateCouponDto;

describe('CouponsService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildCouponMocks();
    await expect(service.create(asCreateDto())).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('create', () => {
    it('normalizes the code and persists defaults', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(null);

      await service.create(asCreateDto({ code: ' save10 ' }), TENANT);

      expect(couponRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SAVE10',
          description: null,
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          minOrderAmount: 0,
          maxDiscountAmount: null,
          usageLimit: null,
          perUserLimit: null,
          startsAt: null,
          expiresAt: null,
          isActive: true,
        }),
      );
    });

    it('rejects a duplicate code', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity());

      await expect(service.create(asCreateDto(), TENANT)).rejects.toThrow(
        'Coupon code already exists',
      );
      expect(couponRepo.save).not.toHaveBeenCalled();
    });

    it('converts a unique violation race into a friendly 400', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(null);
      couponRepo.save.mockImplementationOnce(() => {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      });

      await expect(service.create(asCreateDto(), TENANT)).rejects.toThrow(
        'Coupon code already exists',
      );
    });

    it('rejects a percentage above 100', async () => {
      const { service } = buildCouponMocks();
      await expect(
        service.create(asCreateDto({ discountValue: 150 }), TENANT),
      ).rejects.toThrow('Invalid discount value');
    });

    it('rejects a non-positive fixed amount', async () => {
      const { service } = buildCouponMocks();
      await expect(
        service.create(
          asCreateDto({
            discountType: DiscountType.FIXED_AMOUNT,
            discountValue: 0,
          }),
          TENANT,
        ),
      ).rejects.toThrow('Invalid discount value');
    });

    it('rejects maxDiscountAmount on a fixed coupon', async () => {
      const { service } = buildCouponMocks();
      await expect(
        service.create(
          asCreateDto({
            discountType: DiscountType.FIXED_AMOUNT,
            discountValue: 5,
            maxDiscountAmount: 2,
          }),
          TENANT,
        ),
      ).rejects.toThrow(
        'maxDiscountAmount is only supported for percentage coupons',
      );
    });

    it('accepts maxDiscountAmount on a percentage coupon', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(null);

      await service.create(
        asCreateDto({ discountValue: 20, maxDiscountAmount: 15 }),
        TENANT,
      );

      expect(couponRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ maxDiscountAmount: 15 }),
      );
    });

    it('rejects an inverted date range', async () => {
      const { service } = buildCouponMocks();
      await expect(
        service.create(
          asCreateDto({
            startsAt: '2026-02-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:00:00.000Z',
          }),
          TENANT,
        ),
      ).rejects.toThrow('startsAt must be before expiresAt');
    });
  });

  describe('findAll', () => {
    it('returns a paginated result with default page and limit', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findAndCount.mockResolvedValue([[couponEntity()], 1]);

      const result = await service.findAll({}, TENANT);

      expect(couponRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(result.data[0]).toMatchObject({ id: 1, code: 'SAVE10' });
    });

    it('clamps the limit to 50 and computes the skip from the page', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findAndCount.mockResolvedValue([[], 100]);

      const result = await service.findAll({ page: 3, limit: 500 }, TENANT);

      expect(couponRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 50 }),
      );
      expect(result).toMatchObject({ page: 3, limit: 50, total: 100 });
    });

    it('applies a whitelisted sort field and direction', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'code', sortOrder: 'asc' }, TENANT);

      expect(couponRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { code: 'ASC' } }),
      );
    });

    it('falls back to createdAt for an unknown sort field', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'password', sortOrder: 'asc' }, TENANT);

      expect(couponRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'ASC' } }),
      );
    });

    it('passes the isActive and code filters through', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ isActive: true, code: 'save10' }, TENANT);

      expect(couponRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, code: 'SAVE10' } }),
      );
    });
  });

  describe('findOne', () => {
    it('throws 404 when missing', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(1, TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('serializes remaining uses', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({ usageLimit: 5, usageCount: 2 }),
      );

      const result = await service.findOne(1, TENANT);

      expect(result).toMatchObject({ id: 1, usageLimit: 5, remainingUses: 3 });
    });
  });

  describe('update', () => {
    it('applies a partial patch', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ isActive: false }));

      await service.update(1, { isActive: false }, TENANT);

      expect(couponRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { isActive: false },
      );
    });

    it('rejects changing the code of a redeemed coupon', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ usageCount: 3 }));

      await expect(
        service.update(1, { code: 'NEW10' }, TENANT),
      ).rejects.toThrow('Cannot change the code of a redeemed coupon');
      expect(couponRepo.update).not.toHaveBeenCalled();
    });

    it('re-checks code uniqueness when the code changes', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockImplementation(
        (where: Record<string, unknown>) => {
          if (where.code === 'NEW10') {
            return Promise.resolve(couponEntity({ id: 2, code: 'NEW10' }));
          }
          return Promise.resolve(couponEntity());
        },
      );

      await expect(
        service.update(1, { code: 'NEW10' }, TENANT),
      ).rejects.toThrow('Coupon code already exists');
    });

    it('validates the merged values', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
        }),
      );

      await expect(
        service.update(1, { discountValue: 150 }, TENANT),
      ).rejects.toThrow('Invalid discount value');
    });

    it('throws 404 when missing', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.update(1, { isActive: false }, TENANT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setStatus', () => {
    it('toggles the active flag', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ isActive: true }));

      await service.setStatus(1, false, TENANT);

      expect(couponRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { isActive: false },
      );
    });
  });

  describe('remove', () => {
    it('returns 409 for a redeemed coupon', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ usageCount: 1 }));

      await expect(service.remove(1, TENANT)).rejects.toThrow(
        ConflictException,
      );
      expect(couponRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes an unredeemed coupon', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ usageCount: 0 }));

      await expect(service.remove(1, TENANT)).resolves.toEqual({
        deleted: true,
      });
      expect(couponRepo.delete).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('validate', () => {
    it('returns 400 when the coupon does not exist', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(null);

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Coupon not found',
      );
    });

    it('rejects an inactive coupon', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ isActive: false }));

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Coupon is not active',
      );
    });

    it('rejects a coupon that has not started', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({ startsAt: new Date(Date.now() + 60_000) }),
      );

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Coupon is not active yet',
      );
    });

    it('rejects an expired coupon', async () => {
      const { service, couponRepo } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({ expiresAt: new Date(Date.now() - 60_000) }),
      );

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Coupon has expired',
      );
    });

    it('rejects a cart below the minimum order amount', async () => {
      const { service, couponRepo, cartMocks } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({ minOrderAmount: 50 }),
      );
      cartMocks.getCart.mockResolvedValue({ subtotal: 10 });

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Order does not meet the minimum amount for this coupon',
      );
    });

    it('rejects a coupon whose global usage limit is reached', async () => {
      const { service, couponRepo, cartMocks } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({ usageLimit: 1, usageCount: 1 }),
      );
      cartMocks.getCart.mockResolvedValue({ subtotal: 100 });

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Coupon usage limit reached',
      );
    });

    it('rejects a coupon already used by the customer', async () => {
      const { service, couponRepo, redemptionRepo, cartMocks } =
        buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(couponEntity({ perUserLimit: 1 }));
      cartMocks.getCart.mockResolvedValue({ subtotal: 100 });
      redemptionRepo.count.mockResolvedValue(1);

      await expect(service.validate('SAVE10', 7, TENANT)).rejects.toThrow(
        'Coupon already used',
      );
    });

    it('previews the discount without consuming usage', async () => {
      const { service, couponRepo, cartMocks } = buildCouponMocks();
      couponRepo.findOneBy.mockResolvedValue(
        couponEntity({ discountValue: 10 }),
      );
      cartMocks.getCart.mockResolvedValue({ subtotal: 100 });

      const result = await service.validate('save10', 7, TENANT);

      expect(cartMocks.getCart).toHaveBeenCalledWith(7, TENANT);
      expect(couponRepo.findOneBy).toHaveBeenCalledWith({ code: 'SAVE10' });
      expect(result).toMatchObject({
        code: 'SAVE10',
        subtotal: 100,
        discountAmount: 10,
        total: 90,
      });
      expect(couponRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe('validateAndConsume', () => {
    it('locks the coupon row and returns the discount snapshot', async () => {
      const { service, couponQb, entityManager } = buildCouponMocks();
      couponQb.getOne.mockResolvedValue(couponEntity({ discountValue: 10 }));

      const result = await service.validateAndConsume(entityManager, {
        code: 'save10',
        userId: 7,
        subtotal: 100,
      });

      expect(couponQb.where).toHaveBeenCalledWith('coupon.code = :code', {
        code: 'SAVE10',
      });
      expect(couponQb.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['coupon'],
      );
      expect(result).toEqual({
        couponId: 1,
        discountAmount: 10,
        snapshot: {
          couponId: 1,
          couponCode: 'SAVE10',
          couponDiscountType: DiscountType.PERCENTAGE,
          couponDiscountValue: 10,
        },
      });
    });

    it('re-reads the per-user limit after locking', async () => {
      const { service, couponQb, redemptionRepo, entityManager } =
        buildCouponMocks();
      couponQb.getOne.mockResolvedValue(couponEntity({ perUserLimit: 1 }));
      redemptionRepo.count.mockResolvedValue(1);

      await expect(
        service.validateAndConsume(entityManager, {
          code: 'SAVE10',
          userId: 7,
          subtotal: 100,
        }),
      ).rejects.toThrow('Coupon already used');
    });

    it('rejects an unknown coupon', async () => {
      const { service, couponQb, entityManager } = buildCouponMocks();
      couponQb.getOne.mockResolvedValue(null);

      await expect(
        service.validateAndConsume(entityManager, {
          code: 'SAVE10',
          userId: 7,
          subtotal: 100,
        }),
      ).rejects.toThrow('Coupon not found');
    });
  });

  describe('consume', () => {
    it('increments the counter and inserts a redemption', async () => {
      const { service, couponRepo, redemptionRepo, entityManager } =
        buildCouponMocks();

      await service.consume(entityManager, {
        couponId: 1,
        orderId: 10,
        userId: 7,
        discountAmount: 10,
      });

      expect(couponRepo.increment).toHaveBeenCalledWith(
        { id: 1 },
        'usageCount',
        1,
      );
      expect(redemptionRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          couponId: 1,
          orderId: 10,
          userId: 7,
          discountAmount: 10,
        }),
      );
    });
  });

  describe('restoreUsage', () => {
    it('is a no-op for an order without a coupon', async () => {
      const { service, redemptionRepo, couponQb, entityManager } =
        buildCouponMocks();

      await service.restoreUsage(entityManager, {
        id: 1,
        couponId: null,
      } as unknown as Order);

      expect(redemptionRepo.delete).not.toHaveBeenCalled();
      expect(couponQb.execute).not.toHaveBeenCalled();
    });

    it('deletes the redemption and decrements the counter', async () => {
      const { service, redemptionRepo, couponQb, entityManager } =
        buildCouponMocks();
      redemptionRepo.delete.mockResolvedValue({ affected: 1 });

      await service.restoreUsage(entityManager, {
        id: 10,
        couponId: 1,
      } as unknown as Order);

      expect(redemptionRepo.delete).toHaveBeenCalledWith({
        orderId: 10,
        couponId: 1,
      });
      expect(couponQb.execute).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when no redemption row exists', async () => {
      const { service, redemptionRepo, couponQb, entityManager } =
        buildCouponMocks();
      redemptionRepo.delete.mockResolvedValue({ affected: 0 });

      await service.restoreUsage(entityManager, {
        id: 10,
        couponId: 1,
      } as unknown as Order);

      expect(couponQb.execute).not.toHaveBeenCalled();
    });
  });
});
