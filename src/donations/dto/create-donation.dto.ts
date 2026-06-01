import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';

export class CreateDonationDto {
  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsString()
  @MaxLength(200)
  txHash?: string;

  @IsOptional()
  @IsString()
  tipAmount?: string;

  @IsOptional()
  @IsString()
  tipAsset?: string;
}
