/** DTO for authenticated user's full profile response */
export class UserProfileDto {
  id: string;
  walletAddress: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  role: string;
  kycStatus: string;
  createdAt: Date;
  updatedAt: Date;

  // Stats
  totalRaised?: number;
  totalDonated?: number;
  campaignCount?: number;
}

/** DTO for a user's public-facing profile */
export class PublicUserProfileDto {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  kycStatus: string;
  campaignCount: number;
  totalRaised: number;
}
