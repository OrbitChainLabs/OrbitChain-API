import { AcceptedAssetInput } from './accepted-asset-input.dto';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsArray,
  IsNotEmpty,
  IsNumberString,
  Matches,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class MilestoneInput {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d+(?:\.\d+)?$/, {
    message: 'targetAmount must be greater than 0',
  })
  targetAmount!: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

/** DTO for creating a new fundraising campaign */
export class CreateCampaignDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  story?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  goalAmount?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneInput)
  milestones?: MilestoneInput[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AcceptedAssetInput)
  acceptedAssets?: AcceptedAssetInput[];

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}