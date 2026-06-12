import { Type } from 'class-transformer';
import { IsOptional, IsNumber, Min, Max, IsString, IsIn } from 'class-validator';

/** Query DTO for browsing campaigns with pagination, filtering, and sorting */
export class BrowseCampaignsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['newest', 'mostFunded', 'endingSoon'])
  sortBy: string = 'newest';
}

export class BrowseCampaignsResponseDto {
  data: any[];
  total: number;
  page: number;
  limit: number;
}
