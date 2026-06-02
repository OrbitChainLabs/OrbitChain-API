import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RequestFundReleaseDto {
  @IsNotEmpty()
  @IsString()
  amount: string;

  @IsOptional()
  @IsString()
  releaseReason?: string;

  @IsOptional()
  @IsString()
  signaturePayload?: string;
}

export class FundReleaseResponseDto {
  id: string;
  milestoneId: string;
  campaignId: string;
  creatorId: string;
  amount: string;
  status: string;
  txHash: string | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class FundReleaseDetailDto {
  id: string;
  milestoneId: string;
  campaignId: string;
  campaignTitle: string;
  amount: string;
  status: string;
  releaseReason: string | null;
  txHash: string | null;
  approvedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
}
