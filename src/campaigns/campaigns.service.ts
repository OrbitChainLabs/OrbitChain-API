import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateCampaign(
    userId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.creatorId !== userId) {
      throw new ForbiddenException('Only the campaign creator can update this');
    }

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

  async createCampaign(userId: string, dto: any) {
    // Prepare milestone create data if provided
    const milestoneCreates = (dto.milestones || []).map((m: any) => ({
      title: m.title,
      description: m.description ?? null,
      targetAmount: m.targetAmount ?? undefined,
      dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
    }));

    const data: any = {
      title: dto.title,
      description: dto.description ?? dto.story ?? undefined,
      imageUrl: dto.coverImageUrl ?? undefined,
      category: dto.category ?? undefined,
      goalAmount: dto.goalAmount ?? undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: 'ACTIVE',
      creatorId: userId,
      milestones: milestoneCreates.length > 0 ? { create: milestoneCreates } : undefined,
    };

    const created = await this.prisma.campaign.create({
      data,
      include: { milestones: true },
    });

    return created;
  }
}
