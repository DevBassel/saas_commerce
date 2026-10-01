import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCurrencyChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
