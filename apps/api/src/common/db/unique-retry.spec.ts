import { isUniqueViolation, withUniqueRetry } from './unique-retry';

describe('isUniqueViolation', () => {
  it('accepts a top-level Postgres 23505 code', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('accepts a driverError code', () => {
    expect(isUniqueViolation({ driverError: { code: '23505' } })).toBe(true);
  });

  it('prefers the top-level code when both are present', () => {
    expect(
      isUniqueViolation({ code: '42601', driverError: { code: '23505' } }),
    ).toBe(false);
  });

  it('rejects other codes, null and non-objects', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation({ driverError: { code: '23503' } })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('boom')).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});

describe('withUniqueRetry', () => {
  it('returns the first result without retrying', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    await expect(withUniqueRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries once after a unique violation and returns the second result', async () => {
    const error = { code: '23505' };
    const operation = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('second');

    await expect(withUniqueRetry(operation)).resolves.toBe('second');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-unique errors without retrying', async () => {
    const error = new Error('database down');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(withUniqueRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('propagates a second unique violation (only one retry)', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ code: '23505' })
      .mockRejectedValueOnce({ code: '23505' });

    await expect(withUniqueRetry(operation)).rejects.toEqual({ code: '23505' });
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
