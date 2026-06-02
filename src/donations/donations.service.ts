import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignsService } from '../campaigns/campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  StellarAcceptedAsset,
  StellarTransactionsService,
} from '../stellar/stellar-transactions.service.js';
import { CreateDonationDto } from './dto/create-donation.dto';

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly stellarTxs: StellarTransactionsService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async createDonation(walletAddress: string, dto: CreateDonationDto) {
    if (!walletAddress) {
      throw new BadRequestException('Missing walletAddress in token');
    }

    const existing = await this.db.donation.findUnique({
      where: { txHash: dto.txHash },
    });
    if (existing) {
      return existing;
    }

    const campaign = await this.db.campaign.findUnique({
      where: { id: dto.campaignId },
    });
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationResponseDto, PlatformTipResponseDto } from './dto/donation.dto';

@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDonation(
    userId: string,
    dto: CreateDonationDto,
  ): Promise<{ donation: DonationResponseDto; tip: PlatformTipResponseDto | null }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.contractId) {
      throw new BadRequestException('Campaign contractId is not set');
    }

    const requestedAsset = parseAsset(dto.assetCode, dto.assetIssuer);
    const acceptedAssets = coerceAcceptedAssets(campaign.acceptedAssets);

    await this.stellarTxs.verifyDonationTransaction({
      txHash: dto.txHash,
      destination: campaign.contractId,
      amount: dto.amount,
      asset: requestedAsset,
      acceptedAssets,
    });

    const donor = await this.getOrCreateUserByWallet(walletAddress);

    const created = await this.db.donation.create({
      data: {
        donorId: donor.id,
        campaignId: campaign.id,
        amount: dto.amount,
        assetCode: dto.assetCode.toUpperCase(),
        assetIssuer: requestedAsset.assetType === 'credit' ? requestedAsset.issuer : null,
        txHash: dto.txHash,
        isAnonymous: dto.isAnonymous ?? false,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        donatedAt: new Date(),
      },
    });

    await this.campaigns.recalculateCampaignStats(campaign.id);

    return created;
  }

  private async getOrCreateUserByWallet(walletAddress: string) {
    const existing = await this.db.user.findUnique({
      where: { walletAddress },
    });
    if (existing) return existing;

    return this.db.user.create({
      data: {
        walletAddress,
        email: `${walletAddress}@stellaraid.local`,
        role: 'DONOR',
      },
    });
  }
}

function parseAsset(assetCode: string, assetIssuer?: string): StellarAcceptedAsset {
  const code = String(assetCode ?? '').trim();
  if (!code) {
    throw new BadRequestException('assetCode is required');
  }

  if (code.toUpperCase() === 'XLM') {
    return { assetType: 'native' };
  }

  const issuer = String(assetIssuer ?? '').trim();
  if (!issuer) {
    throw new BadRequestException('assetIssuer is required for non-native assets');
  }

  return { assetType: 'credit', code, issuer };
}

function coerceAcceptedAssets(value: unknown): StellarAcceptedAsset[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ assetType: 'native' }];
  }

  const parsed: StellarAcceptedAsset[] = [];
  for (const item of value) {
    if (item && typeof item === 'object') {
      const assetType = (item as any).assetType;
      if (assetType === 'native') {
        parsed.push({ assetType: 'native' });
        continue;
      }
      if (assetType === 'credit') {
        const code = String((item as any).code ?? '');
        const issuer = String((item as any).issuer ?? '');
        if (code && issuer) {
          parsed.push({ assetType: 'credit', code, issuer });
        }
      }
    }
  }

  return parsed.length > 0 ? parsed : [{ assetType: 'native' }];
    if (campaign.status !== 'ACTIVE') {
      throw new BadRequestException('Campaign is not accepting donations');
    }

    const donationData: Prisma.DonationCreateInput = {
      amount: dto.amount,
      assetCode: dto.assetCode || 'XLM',
      txHash: dto.txHash || null,
      status: 'PENDING',
      isAnonymous: dto.isAnonymous ?? false,
      donor: { connect: { id: userId } },
      campaign: { connect: { id: dto.campaignId } },
    };

    let tip: PlatformTipResponseDto | null = null;

    if (dto.tipAmount) {
      const tipAmountValue = parseFloat(dto.tipAmount);
      if (tipAmountValue <= 0) {
        throw new BadRequestException('Tip amount must be greater than 0');
      }

      if (dto.tipAsset && !['XLM', 'USDC', 'EURC'].includes(dto.tipAsset)) {
        throw new BadRequestException('Unsupported tip asset');
      }

      const txHashTip = `${dto.txHash || `tip-${Date.now()}-${userId.slice(0, 8)}`}-tip`;

      const tipData: Prisma.PlatformTipCreateInput = {
        amount: dto.tipAmount,
        assetCode: dto.tipAsset || 'XLM',
        txHash: txHashTip,
        status: 'PENDING',
        donor: { connect: { id: userId } },
      };

      const createdTip = await this.prisma.platformTip.create({
        data: tipData,
      });

      donationData.tip = { connect: { id: createdTip.id } };

      tip = {
        id: createdTip.id,
        amount: createdTip.amount.toString(),
        assetCode: createdTip.assetCode,
        txHash: createdTip.txHash,
        status: createdTip.status,
        donorId: userId,
        donationId: null,
        confirmedAt: createdTip.confirmedAt,
        createdAt: createdTip.createdAt,
      };
    }

    const donation = await this.prisma.donation.create({
      data: donationData,
      include: { tip: true },
    });

    const totalIncrement = parseFloat(dto.amount) + (dto.tipAmount ? parseFloat(dto.tipAmount) : 0);

    await this.prisma.campaign.update({
      where: { id: dto.campaignId },
      data: {
        raisedAmount: {
          increment: totalIncrement,
        },
      },
    });

    return {
      donation: {
        id: donation.id,
        amount: donation.amount.toString(),
        assetCode: donation.assetCode,
        txHash: donation.txHash,
        status: donation.status,
        donorId: donation.donorId,
        campaignId: donation.campaignId,
        tipAmount: donation.tipAmount?.toString() || null,
        tipAsset: donation.tipAsset || null,
        tipId: donation.tipId,
        donatedAt: donation.donatedAt,
        confirmedAt: donation.confirmedAt,
        createdAt: donation.createdAt,
      },
      tip,
    };
  }

  async verifyDonationOnChain(txHash: string): Promise<boolean> {
    try {
      const donation = await this.prisma.donation.findUnique({
        where: { txHash },
      });

      if (!donation) {
        return false;
      }

      const SorobanRpc = (await import('@stellar/stellar-sdk')).SorobanRpc;
      const server = new SorobanRpc.Server('https://soroban-rpc.stellar.org');

      const response = await server.getTransaction(txHash);

      if (response.status === 'SUCCESS') {
        await this.prisma.donation.update({
          where: { txHash },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });

        const updated = await this.prisma.donation.findUnique({
          where: { txHash },
          include: { tip: true },
        });

        if (updated?.tip && updated.tip.status === 'PENDING') {
          await this.prisma.platformTip.update({
            where: { id: updated.tip.id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
          });
        }

        return true;
      } else {
        await this.prisma.donation.update({
          where: { txHash },
          data: { status: 'FAILED' },
        });

        return false;
      }
    } catch (error) {
      console.error('On-chain verification error:', error);
      return false;
    }
  }

  async verifyTipOnChain(txHash: string): Promise<boolean> {
    try {
      const tip = await this.prisma.platformTip.findUnique({
        where: { txHash },
      });

      if (!tip) {
        return false;
      }

      const SorobanRpc = (await import('@stellar/stellar-sdk')).SorobanRpc;
      const server = new SorobanRpc.Server('https://soroban-rpc.stellar.org');

      const response = await server.getTransaction(txHash);

      if (response.status === 'SUCCESS') {
        await this.prisma.platformTip.update({
          where: { txHash },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });

        if (tip.donationId) {
          await this.prisma.donation.update({
            where: { id: tip.donationId },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
          });
        }

        return true;
      } else {
        await this.prisma.platformTip.update({
          where: { txHash },
          data: { status: 'FAILED' },
        });

        return false;
      }
    } catch (error) {
      console.error('Tip on-chain verification error:', error);
      return false;
    }
  }

  async findAll(userId: string) {
    return this.prisma.donation.findMany({
      where: { donorId: userId },
      include: { tip: true },
      orderBy: { donatedAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const donation = await this.prisma.donation.findFirst({
      where: { id, donorId: userId },
      include: { tip: true },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found');
    }

    return donation;
  }

  async getTipRevenue() {
    const result = await this.prisma.platformTip.aggregate({
      where: { status: 'CONFIRMED' },
      _sum: { amount: true },
      _count: true,
    });

    return {
      totalTips: result._count,
      totalRevenue: result._sum.amount?.toString() || '0',
      currency: 'XLM',
    };
  }

  async getAllTips() {
    return this.prisma.platformTip.findMany({
      include: {
        donor: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTipById(id: string) {
    const tip = await this.prisma.platformTip.findUnique({
      where: { id },
      include: {
        donor: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
          },
        },
        donation: {
          select: {
            id: true,
            amount: true,
            campaignId: true,
          },
        },
      },
    });

    if (!tip) {
      throw new NotFoundException('Tip not found');
    }

    return tip;
  }

  /**
   * Get paginated donations for a campaign (public leaderboard)
   */
  async getCampaignDonations(
    campaignId: string,
    page: number = 1,
    limit: number = 20,
    sortBy: 'amount' | 'createdAt' = 'amount',
    order: 'asc' | 'desc' = 'desc',
  ) {
    // Verify campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const skip = (page - 1) * limit;

    // Build orderBy
    const orderByClause = {};
    orderByClause[sortBy] = order;

    // Get total count
    const total = await this.prisma.donation.count({
      where: {
        campaignId,
        status: 'CONFIRMED',
      },
    });

    // Get paginated donations
    const donations = await this.prisma.donation.findMany({
      where: {
        campaignId,
        status: 'CONFIRMED',
      },
      include: {
        donor: {
          select: {
            walletAddress: true,
          },
        },
      },
      orderBy: orderByClause,
      skip,
      take: limit,
    });

    // Add rank and format response; mask wallet for anonymous donations
    const donationsWithRank = donations.map((donation, index) => ({
      rank: skip + index + 1,
      walletAddress: donation.isAnonymous
        ? 'Anonymous'
        : (donation.donor?.walletAddress ?? 'Anonymous'),
      amount: donation.amount.toString(),
      assetCode: donation.assetCode,
      createdAt: donation.createdAt,
      txHash: donation.txHash,
    }));

    return {
      donations: donationsWithRank,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's personal donation history with filters and sorting
   */
  async getUserDonationHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    sortBy: 'amount' | 'createdAt' = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    campaignId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.DonationWhereInput = {
      donorId: userId,
      status: 'CONFIRMED',
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (startDate || endDate) {
      where.donatedAt = {};
      if (startDate) {
        where.donatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.donatedAt.lte = new Date(endDate);
      }
    }

    // Build orderBy
    const orderByClause = {};
    orderByClause[sortBy] = order;

    // Get total count
    const total = await this.prisma.donation.count({ where });

    // Get paginated donations
    const donations = await this.prisma.donation.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: orderByClause,
      skip,
      take: limit,
    });

    // Format response
    const donationHistory = donations.map((donation) => ({
      id: donation.id,
      amount: donation.amount.toString(),
      assetCode: donation.assetCode,
      status: donation.status,
      campaignId: donation.campaignId,
      campaignTitle: donation.campaign?.title || 'Unknown Campaign',
      campaignStatus: donation.campaign?.status || 'UNKNOWN',
      txHash: donation.txHash,
      donatedAt: donation.donatedAt,
      createdAt: donation.createdAt,
    }));

    // Calculate summary
    const totalDonatedResult = await this.prisma.donation.aggregate({
      where,
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const totalDonated = totalDonatedResult._sum.amount?.toString() || '0';
    const totalDonations = totalDonatedResult._count;
    const averageDonation =
      totalDonations > 0
        ? (parseFloat(totalDonated) / totalDonations).toString()
        : '0';

    return {
      donations: donationHistory,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary: {
        totalDonated,
        totalDonations,
        averageDonation,
      },
    };
  }

  /**
   * Export user's donation history as CSV
   */
  async exportUserDonationsAsCSV(
    userId: string,
    campaignId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    // Build where clause
    const where: Prisma.DonationWhereInput = {
      donorId: userId,
      status: 'CONFIRMED',
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (startDate || endDate) {
      where.donatedAt = {};
      if (startDate) {
        where.donatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.donatedAt.lte = new Date(endDate);
      }
    }

    // Get all donations for export
    const donations = await this.prisma.donation.findMany({
      where,
      include: {
        campaign: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { donatedAt: 'desc' },
    });

    // Build CSV header
    const headers = ['Campaign', 'Amount', 'Asset', 'Date', 'Tx Hash', 'USD Equivalent'];
    const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

    // Add data rows (USD equivalent would typically be fetched from cache/DB)
    for (const donation of donations) {
      const row = [
        `"${donation.campaign?.title || 'Unknown'}"`,
        donation.amount.toString(),
        donation.assetCode,
        donation.donatedAt.toISOString().split('T')[0], // Date only
        `"${donation.txHash || ''}"`,
        '0.00', // Placeholder - in production, fetch from price cache
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}
