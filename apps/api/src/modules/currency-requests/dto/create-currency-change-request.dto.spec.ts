import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Currency } from '../../../common/constants/currency.enum';
import { CreateCurrencyChangeRequestDto } from './create-currency-change-request.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreateCurrencyChangeRequestDto, payload));

const hasError = (errors: { property: string }[], property: string) =>
  errors.some((e) => e.property === property);

describe('CreateCurrencyChangeRequestDto', () => {
  it.each(Object.values(Currency))(
    'accepts the valid currency %s',
    async (requestedCurrency) => {
      await expect(check({ requestedCurrency })).resolves.toHaveLength(0);
    },
  );

  it('accepts the optional reason', async () => {
    await expect(
      check({ requestedCurrency: Currency.USD, reason: 'Pricing update' }),
    ).resolves.toHaveLength(0);
  });

  it.each(['', 'USD', 'us', 'usdollar', 1])(
    'rejects the invalid currency %p',
    async (requestedCurrency) => {
      const errors = await check({ requestedCurrency });
      expect(hasError(errors, 'requestedCurrency')).toBe(true);
    },
  );

  it('rejects a missing requestedCurrency', async () => {
    const errors = await check({});
    expect(hasError(errors, 'requestedCurrency')).toBe(true);
  });

  it('rejects a reason longer than 500 characters', async () => {
    const errors = await check({
      requestedCurrency: Currency.EUR,
      reason: 'x'.repeat(501),
    });
    expect(hasError(errors, 'reason')).toBe(true);
  });

  it('rejects a non-string reason', async () => {
    const errors = await check({
      requestedCurrency: Currency.EUR,
      reason: 42,
    });
    expect(hasError(errors, 'reason')).toBe(true);
  });
});
