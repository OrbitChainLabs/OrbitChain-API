import { IsEnum, IsInt, IsOptional, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { WithdrawalStatus } from '../../../../generated/prisma';

export class ListWithdrawalsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
