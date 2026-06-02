import { IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCampaignDonationsQueryDto {
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
  sortBy?: 'amount' | 'createdAt' = 'amount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

export class DonorLeaderboardDto {
  rank: number;
  walletAddress: string;
  amount: string;
  assetCode: string;
  createdAt: Date;
  txHash: string | null;
}

export class GetCampaignDonationsResponseDto {
  donations: DonorLeaderboardDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
