import { IsEnum, IsOptional } from 'class-validator';
import { CurrencyChangeRequestStatus } from '../enums/currency-change-request-status.enum';

export class ListCurrencyChangeRequestsDto {
  @IsOptional()
  @IsEnum(CurrencyChangeRequestStatus)
  status?: CurrencyChangeRequestStatus;
}
