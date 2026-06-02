import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDonationDto {
  @IsString()
  campaignId: string;

  @IsString()
  txHash: string;

  @IsString()
  amount: string;

  @IsString()
  assetCode: string;

  @IsOptional()
  @IsString()
  assetIssuer?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAnonymous?: boolean;
}

import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
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
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  tipAmount?: string;

  @IsOptional()
  @IsString()
  tipAsset?: string;
}
