import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { Donation } from '../donations/entities/donation.entity';
import { CampaignStats, DonationsPerDay, TopDonor } from './interfaces/campaign-stats.interface';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
  ) {}

  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate totals
    const totals = await this.donationRepo
      .createQueryBuilder('d')
      .select('SUM(d.amount)', 'totalRaised')
      .addSelect('COUNT(DISTINCT d.donorId)', 'donorCount')
      .addSelect('AVG(d.amount)', 'avgDonation')
      .where('d.campaignId = :campaignId', { campaignId })
      .getRawOne<{ totalRaised: string; donorCount: string; avgDonation: string }>();

    // Unique assets
    const assetRows = await this.donationRepo
      .createQueryBuilder('d')
      .select('DISTINCT d.assetCode', 'assetCode')
      .where('d.campaignId = :campaignId', { campaignId })
      .getRawMany<{ assetCode: string }>();

    // Donations per day (last 30 days)
    const perDayRows = await this.donationRepo
      .createQueryBuilder('d')
      .select("TO_CHAR(d.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(d.amount)', 'total')
      .where('d.campaignId = :campaignId', { campaignId })
      .andWhere('d.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("TO_CHAR(d.createdAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(d.createdAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany<{ date: string; count: string; total: string }>();

    // Top donors (top 10 by total donated)
    const topDonorRows = await this.donationRepo
      .createQueryBuilder('d')
      .select('d.donorId', 'donorId')
      .addSelect('SUM(d.amount)', 'totalDonated')
      .addSelect('COUNT(*)', 'donationCount')
      .where('d.campaignId = :campaignId', { campaignId })
      .groupBy('d.donorId')
      .orderBy('SUM(d.amount)', 'DESC')
      .limit(10)
      .getRawMany<{ donorId: string; totalDonated: string; donationCount: string }>();

    const donationsPerDay: DonationsPerDay[] = perDayRows.map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10),
      total: parseFloat(r.total),
    }));
    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        title: dto.title ?? campaign.title,
        // Prefer explicit description, fallback to story alias
        description: dto.description ?? dto.story ?? campaign.description,
        // Map coverImageUrl to imageUrl in the DB
        imageUrl: dto.coverImageUrl ?? campaign.imageUrl,
      },
    });

    return updated;
  }

  /**
   * Browse public campaigns with pagination, filtering, and sorting
   * Excludes DRAFT campaigns from public listing
   */
  async browseCampaigns(
    query: BrowseCampaignsQueryDto,
  ): Promise<BrowseCampaignsResponseDto> {
    const { page, limit, category, status, search, sortBy } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.CampaignWhereInput = {
      // Always exclude DRAFT campaigns
      status: {
        not: 'DRAFT',
      },
    };

    // Add category filter if provided
    if (category) {
      where.category = {
        equals: category,
        mode: 'insensitive',
      };
    }

    // Add status filter if provided (in addition to default exclusions)
    if (status) {
      where.status = status as any;
    }

    // Add search filter (searches in title and description)
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Determine order by
    let orderBy: Prisma.CampaignOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'mostFunded':
        orderBy = {
          raisedAmount: 'desc',
        };
        break;
      case 'endingSoon':
        orderBy = {
          endDate: 'asc',
        };
        break;
      case 'newest':
      default:
        orderBy = {
          createdAt: 'desc',
        };
    }

    // Fetch total count
    const total = await this.prisma.campaign.count({ where });

    // Fetch campaigns
    const campaigns = await this.prisma.campaign.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        goalAmount: true,
        raisedAmount: true,
        status: true,
        creatorId: true,
        startDate: true,
        endDate: true,
        imageUrl: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            walletAddress: true,
          },
        },
        _count: {
          select: {
            donations: true,
            milestones: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    return {
      data: campaigns,
      total,
      page,
      limit,
    };
  }

    const topDonors: TopDonor[] = topDonorRows.map((r) => ({
      donorId: r.donorId,
      totalDonated: parseFloat(r.totalDonated),
      donationCount: parseInt(r.donationCount, 10),
    }));

    return {
      campaignId,
      totalRaised: parseFloat(totals?.totalRaised ?? '0'),
      donorCount: parseInt(totals?.donorCount ?? '0', 10),
      uniqueAssets: assetRows.map((r) => r.assetCode),
      avgDonation: parseFloat(totals?.avgDonation ?? '0'),
      donationsPerDay,
      topDonors,
    };
  }
}
