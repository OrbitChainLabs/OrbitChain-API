import { IsOptional, IsInt, Min, Max, IsIn, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUserDonationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['amount', 'createdAt'])
  sortBy?: 'amount' | 'createdAt' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  campaignId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class UserDonationHistoryDto {
  id: string;
  amount: string;
  assetCode: string;
  status: string;
  campaignId: string;
  campaignTitle: string;
  campaignStatus: string;
  txHash: string | null;
  donatedAt: Date;
  createdAt: Date;
}

export class GetUserDonationsResponseDto {
  donations: UserDonationHistoryDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary: {
    totalDonated: string;
    totalDonations: number;
    averageDonation: string;
  };
}

export class ExportDonationHistoryQueryDto {
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv' = 'csv';

  @IsOptional()
  campaignId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
