import { Injectable, NotFoundException } from '@nestjs/common';
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

    if (campaign.status !== 'ACTIVE') {
      throw new BadRequestException('Campaign is not accepting donations');
    }

    const donationData: Prisma.DonationCreateInput = {
      amount: dto.amount,
      assetCode: dto.assetCode || 'XLM',
      txHash: dto.txHash || null,
      status: 'PENDING',
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
}
