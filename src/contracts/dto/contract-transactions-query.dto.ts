import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, Max, Min } from 'class-validator';

export class ContractTransactionsQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}
