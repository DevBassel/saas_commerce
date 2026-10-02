import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewCurrencyChangeRequestDto } from './review-currency-change-request.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ReviewCurrencyChangeRequestDto, payload));

describe('ReviewCurrencyChangeRequestDto', () => {
  it('accepts an empty payload (reviewNote is optional)', async () => {
    await expect(check({})).resolves.toHaveLength(0);
  });

  it('accepts a reviewNote at the 500-character boundary', async () => {
    await expect(check({ reviewNote: 'x'.repeat(500) })).resolves.toHaveLength(
      0,
    );
  });

  it('rejects a reviewNote longer than 500 characters', async () => {
    const errors = await check({ reviewNote: 'x'.repeat(501) });
    expect(errors.some((e) => e.property === 'reviewNote')).toBe(true);
  });

  it('rejects a non-string reviewNote', async () => {
    const errors = await check({ reviewNote: 42 });
    expect(errors.some((e) => e.property === 'reviewNote')).toBe(true);
  });
});
