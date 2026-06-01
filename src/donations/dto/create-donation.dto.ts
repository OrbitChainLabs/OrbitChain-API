import {
  IsString,
  IsOptional,
  MaxLength,
  IsDecimalString,
  IsIn,
} from 'class-validator';

export class CreateDonationDto {
  @IsString()
  campaignId: string;

  @IsDecimalString()
  amount: string;

  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsString()
  @MaxLength(200)
  txHash?: string;

  @IsOptional()
  @IsDecimalString()
  tipAmount?: string;

  @IsOptional()
  @IsString()
  tipAsset?: string;
}
