export interface DonationsPerDay {
  date: string; // YYYY-MM-DD
  count: number;
  total: number;
}

export interface TopDonor {
  donorId: string;
  totalDonated: number;
  donationCount: number;
}

/** Aggregate campaign statistics returned by the stats endpoint */
export interface CampaignStats {
  campaignId: string;
  totalRaised: number;
  donorCount: number;
  uniqueAssets: string[];
  avgDonation: number;
  donationsPerDay: DonationsPerDay[];
  topDonors: TopDonor[];
}
