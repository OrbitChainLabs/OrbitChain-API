import { IsDecimal, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsDecimal({ decimal: '7' })
  @Min(1)
  @Type(() => Number)
  minimumGoal?: number;

  @IsOptional()
  @IsDecimal({ decimal: '4' })
  @Min(0)
  @Max(1)
  @Type(() => Number)
  platformFee?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1095) // Max 3 years
  @Type(() => Number)
  maxCampaignDuration?: number;
}
