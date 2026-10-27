import { validate } from 'class-validator';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { ValidateCouponDto } from '../dto/validate-coupon.dto';
import { DiscountType } from '../constants/discount-type.enum';

describe('Coupons DTO Validation', () => {
  describe('CreateCouponDto', () => {
    it('passes with valid required fields', async () => {
      const dto = new CreateCouponDto();
      dto.code = 'SAVE10';
      dto.discountType = DiscountType.PERCENTAGE;
      dto.discountValue = 10;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails when code is missing', async () => {
      const dto = new CreateCouponDto();
      dto.discountType = DiscountType.PERCENTAGE;
      dto.discountValue = 10;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('fails when code format is invalid', async () => {
      const dto = new CreateCouponDto();
      dto.code = 'invalid code!';
      dto.discountType = DiscountType.PERCENTAGE;
      dto.discountValue = 10;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('fails when code exceeds max length', async () => {
      const dto = new CreateCouponDto();
      dto.code = 'A'.repeat(65);
      dto.discountType = DiscountType.PERCENTAGE;
      dto.discountValue = 10;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('fails when discountType is invalid', async () => {
      const dto = new CreateCouponDto();
      dto.code = 'SAVE10';
      dto.discountType = 'INVALID' as any;
      dto.discountValue = 10;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'discountType')).toBe(true);
    });

    it('fails when discountValue is negative', async () => {
      const dto = new CreateCouponDto();
      dto.code = 'SAVE10';
      dto.discountType = DiscountType.PERCENTAGE;
      dto.discountValue = -5;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
    });

    it('passes with optional fields', async () => {
      const dto = new CreateCouponDto();
      dto.code = 'SAVE10';
      dto.discountType = DiscountType.FIXED_AMOUNT;
      dto.discountValue = 500;
      dto.description = 'Test coupon';
      dto.minOrderAmount = 1000;
      dto.maxDiscountAmount = 2000;
      dto.usageLimit = 100;
      dto.perUserLimit = 1;
      dto.startsAt = '2026-01-01T00:00:00.000Z';
      dto.expiresAt = '2026-12-31T23:59:59.000Z';
      dto.isActive = true;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateCouponDto', () => {
    it('passes with partial valid fields', async () => {
      const dto = new UpdateCouponDto();
      dto.description = 'Updated description';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('passes with empty object (all fields optional)', async () => {
      const dto = new UpdateCouponDto();

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails when discountValue is negative', async () => {
      const dto = new UpdateCouponDto();
      dto.discountValue = -10;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
    });
  });

  describe('ValidateCouponDto', () => {
    it('passes with valid code', async () => {
      const dto = new ValidateCouponDto();
      dto.code = 'SAVE10';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails when code is missing', async () => {
      const dto = new ValidateCouponDto();

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('fails when code format is invalid', async () => {
      const dto = new ValidateCouponDto();
      dto.code = 'invalid code!';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });
  });
});
