import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StellarTransactionsService } from '../stellar/stellar-transactions.service';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ContractBalanceResponseDto } from './dto/contract-balance.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarTransactions: StellarTransactionsService,
  ) {}

  async createCampaign(userId: string, dto: CreateCampaignDto) {
    const milestoneCreates = (dto.milestones || []).map((m) => ({
      title: m.title,
      description: m.description ?? null,
      targetAmount: m.targetAmount ?? undefined,
      dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
    }));

    const acceptedAssets = parseAcceptedAssets(dto.acceptedAssets);

    return this.prisma.campaign.create({
      data: {
        title: dto.title,
        description: dto.description ?? dto.story ?? '',
        story: dto.story ?? null,
        imageUrl: dto.coverImageUrl ?? undefined,
        category: dto.category ?? undefined,
        goalAmount: dto.goalAmount ?? undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: 'ACTIVE',
        creatorId: userId,
        contractId: dto.contractId ?? undefined,
        acceptedAssets: acceptedAssets.length > 0 ? acceptedAssets : undefined,
        milestones:
          milestoneCreates.length > 0 ? { create: milestoneCreates } : undefined,
      },
      include: { milestones: true },
    });
  }

  async updateCampaign(userId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

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

    return this.prisma.campaign.update({
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
        description: dto.description ?? dto.story ?? campaign.description,
        story: dto.story ?? campaign.story,
        imageUrl: dto.coverImageUrl ?? campaign.imageUrl,
      },
    });
  }

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

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      if (trimmedSearch.length < 3) {
        throw new BadRequestException('Search must be at least 3 characters');
      }
      return this.browseCampaignsWithFullTextSearch({
        page,
        limit,
        skip,
        category,
        status,
        search: trimmedSearch,
      });
    }

    const where: Prisma.CampaignWhereInput = {
      status: { not: 'DRAFT' },
    };

    if (category) {
      where.category = {
        equals: category,
        mode: 'insensitive',
      };
    }

    if (status) {
      where.status = status as any;
    }

    let orderBy: Prisma.CampaignOrderByWithRelationInput;
    switch (sortBy) {
      case 'mostFunded':
        orderBy = { raisedAmount: 'desc' };
        break;
      case 'endingSoon':
        orderBy = { endDate: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [total, campaigns] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        select: campaignBrowseSelect(),
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return { data: campaigns, total, page, limit };
  }

  async getFeaturedCampaigns() {
    return this.prisma.campaign.findMany({
      where: {
        isFeatured: true,
        status: { not: 'DRAFT' },
      },
      select: campaignBrowseSelect(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 6,
    });
  }

  async featureCampaign(campaignId: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      if (campaign.isFeatured) {
        return campaign;
      }

      const featuredCount = await tx.campaign.count({
        where: { isFeatured: true },
      });
      if (featuredCount >= 6) {
        throw new BadRequestException('Maximum 6 featured campaigns allowed');
      }

      return tx.campaign.update({
        where: { id: campaignId },
        data: { isFeatured: true },
      });
    });
  }

  async getContractBalance(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.contractId) {
      throw new BadRequestException('Campaign has no contractId set');
    }

    const balances = await this.stellarTransactions.getContractBalances(campaign.contractId);

    // Calculate total on-chain balance
    let onChainTotal = 0;
    for (const b of balances) {
      onChainTotal += parseFloat(b.balance);
    }

    const storedRaisedAmount = parseFloat(campaign.raisedAmount.toString());
    const discrepancyDetected = Math.abs(onChainTotal - storedRaisedAmount) > 0.0001;

    // If discrepancy detected, update the stored raisedAmount
    if (discrepancyDetected) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          raisedAmount: onChainTotal,
        },
      });
    }

    return {
      contractId: campaign.contractId,
      balances,
      storedRaisedAmount: campaign.raisedAmount.toString(),
      onChainTotal: onChainTotal.toString(),
      discrepancyDetected,
    };
  }

  async recalculateCampaignStats(campaignId: string) {
    const agg = await this.prisma.donation.aggregate({
      where: {
        campaignId,
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });

    const raisedAmount = agg._sum.amount ?? new Prisma.Decimal(0);

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { raisedAmount },
    });
  }

  private async browseCampaignsWithFullTextSearch(input: {
    page: number;
    limit: number;
    skip: number;
    category?: string;
    status?: string;
    search: string;
  }): Promise<BrowseCampaignsResponseDto> {
    const { page, limit, skip, category, status, search } = input;

    const filters = sqlCampaignFilters({ category, status });

    const [countRow, rankedRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM campaigns c
        WHERE ${filters.whereSql}
          AND to_tsvector('english',
            coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
          ) @@ plainto_tsquery('english', ${search})
      `,
      this.prisma.$queryRaw<{ id: string; rank: number }[]>`
        SELECT c.id,
          ts_rank(
            to_tsvector('english',
              coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
            ),
            plainto_tsquery('english', ${search})
          ) AS rank
        FROM campaigns c
        WHERE ${filters.whereSql}
          AND to_tsvector('english',
            coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
          ) @@ plainto_tsquery('english', ${search})
        ORDER BY rank DESC, c."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = countRow[0]?.count ?? 0;
    const ids = rankedRows.map((r) => r.id);
    if (ids.length === 0) {
      return { data: [], total, page, limit };
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: ids } },
      select: campaignBrowseSelect(),
    });

    const byId = new Map(campaigns.map((c) => [c.id, c]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as any[];

    return { data: ordered, total, page, limit };
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

function campaignBrowseSelect() {
  return {
    id: true,
    title: true,
    description: true,
    story: true,
    goalAmount: true,
    raisedAmount: true,
    status: true,
    creatorId: true,
    startDate: true,
    endDate: true,
    imageUrl: true,
    category: true,
    isFeatured: true,
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
  } satisfies Prisma.CampaignSelect;
}

function parseAcceptedAssets(values?: string[]) {
  if (!values || values.length === 0) return [];

  return values
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((v) => {
      if (v.toUpperCase() === 'XLM') {
        return { assetType: 'native' as const };
      }
      const [code, issuer] = v.split(':');
      if (!code || !issuer) return null;
      return { assetType: 'credit' as const, code, issuer };
    })
    .filter(Boolean) as Array<
    | { assetType: 'native' }
    | { assetType: 'credit'; code: string; issuer: string }
  >;
}

function sqlCampaignFilters(input: { category?: string; status?: string }) {
  const whereParts: Prisma.Sql[] = [Prisma.sql`c.status <> 'DRAFT'`];

  if (input.status) {
    whereParts.push(Prisma.sql`c.status = ${input.status}`);
  }

  if (input.category) {
    whereParts.push(Prisma.sql`c.category ILIKE ${input.category}`);
  }

  const whereSql =
    whereParts.length === 1
      ? whereParts[0]
      : Prisma.sql`${Prisma.join(whereParts, Prisma.sql` AND `)}`;

  return { whereSql };
}
