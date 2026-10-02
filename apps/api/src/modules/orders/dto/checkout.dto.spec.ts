import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckoutDto } from './checkout.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CheckoutDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('CheckoutDto', () => {
  it('accepts an empty payload (addressId is optional)', async () => {
    await expect(check({})).resolves.toHaveLength(0);
  });

  it('accepts a positive integer addressId', async () => {
    await expect(check({ addressId: 7 })).resolves.toHaveLength(0);
  });

  it.each([0, -1])(
    'rejects addressId below the minimum (%p)',
    async (value) => {
      const errors = await check({ addressId: value });
      expect(errors.some((e) => e.property === 'addressId')).toBe(true);
    },
  );

  it.each([1.5, '5', true])(
    'rejects a non-integer addressId (%p)',
    async (value) => {
      const errors = await check({ addressId: value });
      expect(errors.some((e) => e.property === 'addressId')).toBe(true);
    },
  );
});
