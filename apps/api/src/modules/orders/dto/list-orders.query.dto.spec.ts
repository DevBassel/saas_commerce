import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderStatus } from '../constants/order-status.enum';
import { ListOrdersQueryDto } from './list-orders.query.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ListOrdersQueryDto, payload));

describe('ListOrdersQueryDto', () => {
  it('accepts an empty payload (both filters optional)', async () => {
    await expect(check({})).resolves.toHaveLength(0);
  });

  it.each(Object.values(OrderStatus))(
    'accepts the valid status %s',
    async (status) => {
      await expect(check({ status })).resolves.toHaveLength(0);
    },
  );

  it.each(['', 'pending', 'INVALID', 1])(
    'rejects the invalid status %p',
    async (status) => {
      const errors = await check({ status });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    },
  );

  it('transforms a numeric-string userId and accepts it', async () => {
    const errors = await check({ userId: '42' });
    expect(errors).toHaveLength(0);
  });

  it.each([0, -5])('rejects userId below the minimum (%p)', async (value) => {
    const errors = await check({ userId: value });
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it.each(['abc', 1.5])('rejects a non-integer userId (%p)', async (value) => {
    const errors = await check({ userId: value });
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });
});
