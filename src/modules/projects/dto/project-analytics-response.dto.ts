import { Decimal } from '@prisma/client/runtime/library';

export class ProjectAnalyticsResponseDto {
  totalDonations: number;
  totalAmount: Decimal;
  uniqueDonors: number;
  averageDonation: Decimal;
  fundingVelocity: number; // donations per day
  donationTrends: {
    daily: Array<{
      date: string;
      amount: Decimal;
      count: number;
    }>;
    weekly: Array<{
      week: string;
      amount: Decimal;
      count: number;
    }>;
  };
  topDonors: Array<{
    donorId?: string;
    donorName?: string;
    totalAmount: Decimal;
    donationCount: number;
  }>;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}