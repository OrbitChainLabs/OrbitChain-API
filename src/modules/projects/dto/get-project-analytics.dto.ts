import { IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class GetProjectAnalyticsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  anonymizeTopDonors?: boolean;
}