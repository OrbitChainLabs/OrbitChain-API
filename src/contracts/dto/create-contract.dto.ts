import { IsString, IsNotEmpty, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @IsUUID()
  @IsNotEmpty()
  campaignId: string;

  @IsString()
  @IsNotEmpty()
  network: string;

  @IsDateString()
  @IsOptional()
  deployedAt?: string;

  @IsString()
  @IsNotEmpty()
  deployerAddress: string;
}
