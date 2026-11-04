import { validate } from 'class-validator';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { CreateSubDto } from '../dto/create-sub.dto';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';

describe('Payments DTO Validation', () => {
  describe('CreatePaymentDto', () => {
    it('passes with valid orderId', async () => {
      const dto = new CreatePaymentDto();
      dto.orderId = 1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails when orderId is missing', async () => {
      const dto = new CreatePaymentDto();

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'orderId')).toBe(true);
    });

    it('fails when orderId is not a number', async () => {
      const dto = new CreatePaymentDto();
      dto.orderId = 'not-a-number' as unknown as number;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'orderId')).toBe(true);
    });

    it('passes when orderId is zero (IsNumber does not validate range)', async () => {
      const dto = new CreatePaymentDto();
      dto.orderId = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('passes when orderId is negative (IsNumber does not validate range)', async () => {
      const dto = new CreatePaymentDto();
      dto.orderId = -1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('passes when orderId is a float (IsNumber does not validate integer)', async () => {
      const dto = new CreatePaymentDto();
      dto.orderId = 1.5;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('CreateSubDto', () => {
    it('passes with valid planId', async () => {
      const dto = new CreateSubDto();
      dto.planId = 1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails when planId is missing', async () => {
      const dto = new CreateSubDto();

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'planId')).toBe(true);
    });

    it('passes when planId is zero (IsNumber does not validate range)', async () => {
      const dto = new CreateSubDto();
      dto.planId = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('passes with valid billingInterval', async () => {
      const dto = new CreateSubDto();
      dto.planId = 1;
      dto.billingInterval = BillingInterval.MONTHLY;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails with invalid billingInterval', async () => {
      const dto = new CreateSubDto();
      dto.planId = 1;
      dto.billingInterval = 'INVALID' as unknown as BillingInterval;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'billingInterval')).toBe(true);
    });
  });
});
