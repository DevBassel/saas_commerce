import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterStoreDto } from './register-store.dto';

const valid = (): Record<string, unknown> => ({
  name: 'Alice Doe',
  email: 'alice@example.com',
  password: 'password1',
  storeName: 'My Store',
  storeSlug: 'my-store',
});

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(RegisterStoreDto, payload));

const hasError = (errors: { property: string }[], property: string) =>
  errors.some((e) => e.property === property);

describe('RegisterStoreDto', () => {
  it('accepts a minimal valid payload', async () => {
    await expect(check(valid())).resolves.toHaveLength(0);
  });

  it('accepts the optional subdomain', async () => {
    await expect(
      check({ ...valid(), subdomain: 'alice' }),
    ).resolves.toHaveLength(0);
  });

  it.each(['name', 'email', 'password', 'storeName', 'storeSlug'])(
    'rejects a payload missing the required field %s',
    async (field) => {
      const payload = valid();
      delete payload[field];
      const errors = await check(payload);
      expect(hasError(errors, field)).toBe(true);
    },
  );

  it.each(['Alice', 'Al'])('accepts the valid name %p', async (name) => {
    await expect(check({ ...valid(), name })).resolves.toHaveLength(0);
  });

  it('rejects a name shorter than 2 characters', async () => {
    const errors = await check({ ...valid(), name: 'A' });
    expect(hasError(errors, 'name')).toBe(true);
  });

  it.each(['ab', 'a-b-c', 'my-store-1'])(
    'accepts the valid storeSlug %p',
    async (storeSlug) => {
      await expect(check({ ...valid(), storeSlug })).resolves.toHaveLength(0);
    },
  );

  it.each(['My-Store', 'AL', 'my_store', '-my', 'my-', 'my store', 'A'])(
    'rejects the malformed storeSlug %p',
    async (storeSlug) => {
      const errors = await check({ ...valid(), storeSlug });
      expect(hasError(errors, 'storeSlug')).toBe(true);
    },
  );

  it('rejects a storeSlug longer than 50 characters', async () => {
    const errors = await check({ ...valid(), storeSlug: 'a'.repeat(51) });
    expect(hasError(errors, 'storeSlug')).toBe(true);
  });

  it('rejects a storeName shorter than 2 characters', async () => {
    const errors = await check({ ...valid(), storeName: 'A' });
    expect(hasError(errors, 'storeName')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const errors = await check({ ...valid(), email: 'not-an-email' });
    expect(hasError(errors, 'email')).toBe(true);
  });

  it.each(['short7!', 'a'.repeat(17)])(
    'rejects a password outside 8-16 characters (%p)',
    async (password) => {
      const errors = await check({ ...valid(), password });
      expect(hasError(errors, 'password')).toBe(true);
    },
  );

  it('rejects a non-string subdomain', async () => {
    const errors = await check({ ...valid(), subdomain: 42 });
    expect(hasError(errors, 'subdomain')).toBe(true);
  });
});
