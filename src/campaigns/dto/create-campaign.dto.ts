import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MilestoneInput {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Accept numeric as string to be safe for Decimal columns
  @IsOptional()
  @IsString()
  targetAmount?: string;

  @IsOptional()
  @IsString()
  dueDate?: string; // ISO date string
}

export class CreateCampaignDto {
  @IsString()
  @MaxLength(200)
  title: string;

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
  acceptedAssets?: string[];

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
