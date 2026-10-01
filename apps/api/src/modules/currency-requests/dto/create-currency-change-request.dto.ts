import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Currency } from '../../../common/constants/currency.enum';

export class CreateCurrencyChangeRequestDto {
  @IsEnum(Currency)
  requestedCurrency: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
