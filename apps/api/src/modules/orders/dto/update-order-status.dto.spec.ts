import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderStatus } from '../constants/order-status.enum';
import { UpdateOrderStatusDto } from './update-order-status.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(UpdateOrderStatusDto, payload));

describe('UpdateOrderStatusDto', () => {
  it.each(Object.values(OrderStatus))(
    'accepts the valid status %s',
    async (status) => {
      await expect(check({ status })).resolves.toHaveLength(0);
    },
  );

  it.each(['', 'pending', 'INVALID', 1, true])(
    'rejects the invalid status %p',
    async (status) => {
      const errors = await check({ status });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    },
  );

  it('rejects a missing status', async () => {
    const errors = await check({});
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
