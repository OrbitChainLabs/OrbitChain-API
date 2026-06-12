import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

/** DTO for updating an existing campaign (partial update) */
export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Some clients send a 'story' field — treat as an alias for description
  @IsOptional()
  @IsString()
  story?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  coverImageUrl?: string;
}
