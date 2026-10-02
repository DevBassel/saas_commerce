import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAddressDto } from './create-address.dto';

const valid = (): Record<string, unknown> => ({
  recipientName: 'Alice Doe',
  phone: '+1 (555) 123-4567',
  line1: '1 Main St',
  city: 'Springfield',
  postalCode: '12345',
  country: 'US',
});

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreateAddressDto, payload));

const hasError = (errors: { property: string }[], property: string) =>
  errors.some((e) => e.property === property);

describe('CreateAddressDto', () => {
  it('accepts a minimal valid payload', async () => {
    await expect(check(valid())).resolves.toHaveLength(0);
  });

  it('accepts all optional fields', async () => {
    const errors = await check({
      ...valid(),
      line2: 'Apt 4',
      state: 'IL',
      label: 'Home',
      isDefault: true,
    });
    expect(errors).toHaveLength(0);
  });

  it.each(['recipientName', 'phone', 'line1', 'city', 'postalCode', 'country'])(
    'rejects a payload missing the required field %s',
    async (field) => {
      const payload = valid();
      delete payload[field];
      const errors = await check(payload);
      expect(hasError(errors, field)).toBe(true);
    },
  );

  it.each(['abc', '123', '+1'.padEnd(51, '1'), '', '555 ext'])(
    'rejects the malformed phone %p',
    async (phone) => {
      const errors = await check({ ...valid(), phone });
      expect(hasError(errors, 'phone')).toBe(true);
    },
  );

  it.each(['+1 (555) 123-4567', '+20-100-000-0000', '55512', '(+1) 555 123'])(
    'accepts the valid phone %p',
    async (phone) => {
      await expect(check({ ...valid(), phone })).resolves.toHaveLength(0);
    },
  );

  it.each(['USA', 'U', '12', 'U$'])(
    'rejects the malformed country %p',
    async (country) => {
      const errors = await check({ ...valid(), country });
      expect(hasError(errors, 'country')).toBe(true);
    },
  );

  it.each(['US', 'us', 'Eg'])(
    'accepts the valid country %p',
    async (country) => {
      await expect(check({ ...valid(), country })).resolves.toHaveLength(0);
    },
  );

  it.each([
    ['recipientName', 256],
    ['line1', 256],
    ['city', 121],
    ['postalCode', 33],
    ['line2', 256],
    ['state', 121],
    ['label', 61],
  ])('rejects %s longer than its max length', async (field, max) => {
    const errors = await check({
      ...valid(),
      [field]: 'x'.repeat(max),
    });
    expect(hasError(errors, field)).toBe(true);
  });

  it.each(['recipientName', 'line1', 'city', 'postalCode'])(
    'rejects an empty %s',
    async (field) => {
      const errors = await check({ ...valid(), [field]: '' });
      expect(hasError(errors, field)).toBe(true);
    },
  );

  it('rejects a non-string recipientName', async () => {
    const errors = await check({ ...valid(), recipientName: 42 });
    expect(hasError(errors, 'recipientName')).toBe(true);
  });

  it('rejects a non-boolean isDefault', async () => {
    const errors = await check({ ...valid(), isDefault: 'yes' });
    expect(hasError(errors, 'isDefault')).toBe(true);
  });
});
