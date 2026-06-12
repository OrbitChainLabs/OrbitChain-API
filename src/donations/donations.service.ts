import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CampaignsService } from '../campaigns/campaigns.service';
import {
  StellarAcceptedAsset,
  StellarTransactionsService,
} from '../stellar/stellar-transactions.service.js';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationResponseDto, PlatformTipResponseDto } from './dto/donation.dto';

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly stellarTxs: StellarTransactionsService,
  ) {}

  /** Creates a donation after verifying the transaction on Stellar */
  async createDonation(
    walletAddress: string,
    dto: CreateDonationDto,
  ): Promise<{ donation: DonationResponseDto; tip: PlatformTipResponseDto | null }> {
    if (!walletAddress) {
      throw new BadRequestException('Missing walletAddress in token');
    }

    const existing = await this.prisma.donation.findUnique({
      where: { txHash: dto.txHash },
    });
    if (existing) {
      return {
        donation: {
          id: existing.id,
          amount: existing.amount.toString(),
          assetCode: existing.assetCode,
          txHash: existing.txHash,
          status: existing.status,
          donorId: existing.donorId,
          campaignId: existing.campaignId,
          tipAmount: existing.tipAmount?.toString() || null,
          tipAsset: existing.tipAsset || null,
          tipId: existing.tipId,
          donatedAt: existing.donatedAt,
          confirmedAt: existing.confirmedAt,
          createdAt: existing.createdAt,
        },
        tip: null,
      };
    }

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

    const created = await this.prisma.donation.create({
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

    return {
      donation: {
        id: created.id,
        amount: created.amount.toString(),
        assetCode: created.assetCode,
        txHash: created.txHash,
        status: created.status,
        donorId: created.donorId,
        campaignId: created.campaignId,
        tipAmount: null,
        tipAsset: null,
        tipId: null,
        donatedAt: created.donatedAt,
        confirmedAt: created.confirmedAt,
        createdAt: created.createdAt,
      },
      tip: null,
    };
  }

  /** Get all donations for a user ordered by most recent first */
  async findAll(userId: string) {
    return this.prisma.donation.findMany({
      where: { donorId: userId },
      include: { tip: true },
      orderBy: { donatedAt: 'desc' },
    });
  }

  /** Get a single donation by ID, scoped to the requesting user */
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

  /** Verify a donation transaction on the Stellar network and update its status */
  async verifyDonationOnChain(txHash: string): Promise<boolean> {
    try {
      const donation = await this.prisma.donation.findUnique({
        where: { txHash },
      });

      if (!donation) return false;

      const { SorobanRpc } = await import('@stellar/stellar-sdk');
      const server = new SorobanRpc.Server('https://soroban-rpc.stellar.org');
      const response = await server.getTransaction(txHash);

      if (response.status === 'SUCCESS') {
        await this.prisma.donation.update({
          where: { txHash },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });

        const updated = await this.prisma.donation.findUnique({
          where: { txHash },
          include: { tip: true },
        });

        if (updated?.tip && updated.tip.status === 'PENDING') {
          await this.prisma.platformTip.update({
            where: { id: updated.tip.id },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
          });
        }

        return true;
      }

      await this.prisma.donation.update({
        where: { txHash },
        data: { status: 'FAILED' },
      });
      return false;
    } catch {
      return false;
    }
  }

  /** Verify a platform tip transaction on-chain */
  async verifyTipOnChain(txHash: string): Promise<boolean> {
    try {
      const tip = await this.prisma.platformTip.findUnique({
        where: { txHash },
      });

      if (!tip) return false;

      const { SorobanRpc } = await import('@stellar/stellar-sdk');
      const server = new SorobanRpc.Server('https://soroban-rpc.stellar.org');
      const response = await server.getTransaction(txHash);

      if (response.status === 'SUCCESS') {
        await this.prisma.platformTip.update({
          where: { txHash },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });

        if (tip.donationId) {
          await this.prisma.donation.update({
            where: { id: tip.donationId },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
          });
        }

        return true;
      }

      await this.prisma.platformTip.update({
        where: { txHash },
        data: { status: 'FAILED' },
      });
      return false;
    } catch {
      return false;
    }
  }

  /** Get or create a user record by Stellar wallet address */
  private async getOrCreateUserByWallet(walletAddress: string) {
    const existing = await this.prisma.user.findUnique({
      where: { walletAddress },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        walletAddress,
        email: `${walletAddress}@orbitchain.local`,
        role: 'DONOR',
      },
    });
  }
}

/** Parse and validate the donation asset from request */
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

/** Normalize the campaign's acceptedAssets field into a typed array */
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
}
