import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WithdrawalStatus } from '../../../../generated/prisma';

export class ProcessWithdrawalDto {
  @IsEnum(WithdrawalStatus)
  status!: WithdrawalStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  transactionHash?: string;
}
