import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class DonationPerDayDto {
  date: string;
  count: number;
  totalAmount: number;
}

export class AssetBreakdownDto {
  asset: string;
  count: number;
  totalAmount: number;
}

export class TopDonorDto {
  donorId: string;
  donorName: string | null;
  donationCount: number;
  totalAmount: number;
}

export class CampaignDonationAnalyticsResponseDto {
  donationsPerDay: DonationPerDayDto[];
  assetBreakdown: AssetBreakdownDto[];
  top10Donors: TopDonorDto[];
}
