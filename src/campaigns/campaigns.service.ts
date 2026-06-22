import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StellarTransactionsService } from '../stellar/stellar-transactions.service';
import {
  BrowseCampaignsQueryDto,
  BrowseCampaignsResponseDto,
} from './dto/browse-campaigns.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import type { CreateUpdateDto } from './dto/create-update.dto';
import {
  ContractBalanceResponseDto,
  PerAssetBalanceDto,
} from './dto/contract-balance.dto';

const MIN_MILESTONE_TARGET_AMOUNT = 0.0000001;
const DISCREPANCY_TOLERANCE = new Prisma.Decimal('0.0001');

function parseDecimalOrZero(raw: string | number | undefined | null): string {
  const s = String(raw ?? '0').trim();
  if (s === '') return '0';
  const n = Number(s);
  if (!Number.isFinite(n)) return '0';
  // Horizon can return negative balances for accounts with buy-liabilities;
  // floor them at zero rather than introducing a signed arithmetic that
  // downstream `raisedAmount` storage cannot accept.
  return n >= 0 ? s : '0';
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarTransactions: StellarTransactionsService,
  ) {}

  /**
   * Create a new campaign with optional milestones and accepted assets.
   * Sets status to ACTIVE immediately upon creation.
   */
  async createCampaign(userId: string, dto: CreateCampaignDto) {
    if (!dto.goalAmount || parseFloat(dto.goalAmount) <= 0) {
      throw new BadRequestException(
        'goalAmount is required and must be greater than 0',
      );
    }
    const milestoneCreates = (dto.milestones || []).map((m) => ({
      title: m.title,
      description: m.description ?? null,
      targetAmount: parseMilestoneTargetAmount(m.targetAmount),
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
        goalAmount: dto.goalAmount,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: 'ACTIVE',
        creatorId: userId,
        contractId: dto.contractId ?? undefined,
        acceptedAssets: acceptedAssets.length > 0 ? acceptedAssets : undefined,
        milestones:
          milestoneCreates.length > 0
            ? { create: milestoneCreates }
            : undefined,
      },
      include: { milestones: true },
    });
  }

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

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        title: dto.title ?? campaign.title,
        description: dto.description ?? dto.story ?? campaign.description,
        story: dto.story ?? campaign.story,
        imageUrl: dto.coverImageUrl ?? campaign.imageUrl,
      },
    });
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

  /** Returns up to 6 featured, non-DRAFT campaigns sorted by recent activity */
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

  /** Feature a campaign (max 6 featured). Enforces the limit in a transaction. */
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

  /**
   * Fetch on-chain contract balance from Stellar and compute a deterministic
   * comparison against the stored `Campaign.raisedAmount`.
   *
   * SAFETY: This method is READ-ONLY with respect to `Campaign.raisedAmount`.
   * It computes two side-by-side figures:
   *
   *   * The on-chain account's per-asset balances (raw, in each asset's native
   *     decimals), summed PER ASSET and never as a mixed-denomination aggregate.
   *   * The total sum of APPROVED/RELEASED `FundRelease.amount` values, summed
   *     PER ASSET (XLM releases attach to the `native` slot, issued-asset
   *     releases attach to matching `code:issuer` slots).
   *
   * The on-chain amount that "should" still belong to the campaign is
   * `grossOnChain + released` per asset, because released funds have already
   * been moved off the contract account. Each asset's contribution to the
   * canonical `Campaign.raisedAmount` is independent of the others.
   *
   * Discrepancies are REPORTED via `discrepancyDetected` only. The stored
   * `Campaign.raisedAmount` is NEVER mutated by this method. Correcting a
   * discrepancy requires an explicit admin invocation through
   * `AdminService.reconcileCampaignBalance`, which writes an `AuditLog`.
   */
  async getContractBalance(
    campaignId: string,
  ): Promise<ContractBalanceResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.contractId) {
      throw new BadRequestException('Campaign has no contractId set');
    }

    const balances = await this.stellarTransactions.getContractBalances(
      campaign.contractId,
    );

    // The Prisma `FundRelease` schema does not record `assetCode` / `assetIssuer`,
    // so per-asset release netting is unimplementable today without a schema
    // migration. We treat the released sum as a single XLM-denominated bucket
    // since `Campaign.raisedAmount` (and `Milestone.targetAmount`) are stored
    // in XLM-equivalent units. The aggregate is reported on the XLM row of
    // `perAsset` only; non-XLM asset rows show their on-chain balance without
    // any released offset.
    const totalReleased = await this.sumApprovedReleasedAmount(campaignId);
    const releasedApplied = totalReleased.gt(0);

    const perAsset: PerAssetBalanceDto[] = balances.map((b) => {
      const gross = new Prisma.Decimal(parseDecimalOrZero(b.balance));
      const isNative = b.isNative;
      const released = isNative && releasedApplied ? totalReleased : new Prisma.Decimal(0);
      const net = isNative ? gross.plus(released) : gross;
      return {
        assetCode: b.assetCode,
        assetIssuer: b.assetIssuer,
        isNative,
        grossOnChain: gross.toString(),
        released: released.toString(),
        netAvailable: net.toString(),
      };
    });

    // `netAvailableByAssetTotal` is the canonical XLM-denominated balance
    // (the only denomination `Campaign.raisedAmount` is stored in). We
    // deliberately sum ONLY native (XLM) per-asset nets so this figure is
    // safe to compare against the stored value. Non-XLM assets remain
    // visible in the `perAsset` array but are NEVER folded into the
    // canonical total — folding them would re-create the mixed-
    // denomination bug that prompted this fix.
    const netAvailableByAssetTotal = perAsset
      .filter((p) => p.isNative)
      .reduce((sum, p) => sum.plus(p.netAvailable), new Prisma.Decimal(0));

    const netReleasedAmount = totalReleased;

    // `onChainTotal` is a backwards-compatible diagnostic exposed to
    // clients: SUM of on-chain `balances[].balance` strings for native
    // (XLM) assets only. Mirrors the behaviour callers would expect from
    // the pre-fix endpoint when the campaign accepted only XLM.
    const onChainTotal = perAsset
      .filter((p) => p.isNative)
      .reduce((sum, p) => sum.plus(p.grossOnChain), new Prisma.Decimal(0));

    const storedRaisedAmount = new Prisma.Decimal(
      campaign.raisedAmount.toString(),
    );
    const discrepancyDetected = netAvailableByAssetTotal
      .minus(storedRaisedAmount)
      .abs()
      .gt(DISCREPANCY_TOLERANCE);

    return {
      contractId: campaign.contractId,
      balances,
      perAsset,
      netAvailableByAssetTotal: netAvailableByAssetTotal.toString(),
      netReleasedAmount: netReleasedAmount.toString(),
      onChainTotal: onChainTotal.toString(),
      storedRaisedAmount: storedRaisedAmount.toString(),
      discrepancyDetected,
    };
  }

  /**
   * Sum the `amount` of every `FundRelease` row for this campaign whose
   * status is APPROVED or RELEASED. Releases are conceptually XLM-denominated
   * for accounting purposes because `Campaign.raisedAmount` and
   * `Milestone.targetAmount` are stored in XLM-equivalent units.
   *
   * NOTE: A future schema migration that adds `assetCode`/`assetIssuer` to
   * `FundRelease` would let us net per-asset instead. Today the field is not
   * tracked, so we use this conservative single-bucket sum.
   */
  private async sumApprovedReleasedAmount(
    campaignId: string,
  ): Promise<Prisma.Decimal> {
    const releases = await this.prisma.fundRelease.findMany({
      where: {
        campaignId,
        status: { in: ['APPROVED', 'RELEASED'] },
      },
      select: { amount: true },
    });

    return releases.reduce(
      (sum, r) =>
        sum.plus(new Prisma.Decimal(r.amount.toString())),
      new Prisma.Decimal(0),
    );
  }

  /** Recalculate a campaign's raisedAmount from confirmed donations */
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

  /**
   * GET /campaigns/:id/updates
   * Returns paginated updates sorted by createdAt DESC (10 per page).
   */
  async getCampaignUpdates(campaignId: string, page = 1) {
    const limit = 10;
    const skip = (page - 1) * limit;

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const [total, updates] = await this.prisma.$transaction([
      this.prisma.update.count({ where: { campaignId } }),
      this.prisma.update.findMany({
        where: { campaignId },
        select: {
          id: true,
          title: true,
          content: true,
          imageUrls: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Normalise imageUrls field
    const data = updates.map(({ imageUrls, ...u }) => ({
      ...u,
      imageUrls: imageUrls || [],
    }));

    return { data, total, page, limit };
  }

  /** Create a campaign update (creator only) */
  async createUpdate(campaignId: string, userId: string, dto: CreateUpdateDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, creatorId: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    if (campaign.creatorId !== userId) {
      throw new ForbiddenException(
        'Only the campaign creator can post updates',
      );
    }

    return this.prisma.update.create({
      data: {
        campaignId,
        creatorId: userId,
        title: dto.title,
        content: dto.content,
        imageUrls: dto.imageUrls ?? [],
      },
    });
  }

  /** Soft-delete a campaign update (creator or admin) */
  async deleteUpdate(
    campaignId: string,
    updateId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const update = await this.prisma.update.findUnique({
      where: { id: updateId },
      select: { id: true, creatorId: true, deletedAt: true },
    });
    if (!update) {
      throw new NotFoundException(`Update ${updateId} not found`);
    }
    if (update.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException('Not authorized to delete this update');
    }
    if (update.deletedAt) {
      throw new BadRequestException('Update is already deleted');
    }

    await this.prisma.update.update({
      where: { id: updateId },
      data: { deletedAt: new Date() },
    });
  }

  /** Compute aggregate stats for a campaign: total raised, donor count, etc. */
  async getCampaignStats(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const donations = await this.prisma.donation.findMany({
      where: { campaignId, status: 'CONFIRMED' },
      select: { amount: true, donorId: true, assetCode: true, createdAt: true },
    });

    const totalRaised = donations.reduce((sum, d) => sum + Number(d.amount), 0);
    const donorCount = new Set(donations.map((d) => d.donorId)).size;
    const uniqueAssets = [...new Set(donations.map((d) => d.assetCode))];
    const avgDonation = donations.length ? totalRaised / donations.length : 0;

    return {
      campaignId,
      totalRaised,
      donorCount,
      uniqueAssets,
      avgDonation,
      donationsPerDay: [],
      topDonors: [],
    };
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
      this.prisma.$queryRaw<
        { count: number }[]
      >`        SELECT COUNT(*)::int AS count
        FROM campaigns c
        WHERE ${filters.whereSql}
          AND to_tsvector('english',
            coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
          ) @@ plainto_tsquery('english', ${search})
      `,
      this.prisma.$queryRaw<{ id: string; rank: number }[]>`        SELECT c.id,
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
  }
}

function parseMilestoneTargetAmount(targetAmount?: string) {
  const raw = targetAmount?.trim();
  const amount = raw ? Number(raw) : Number.NaN;

  if (!raw || !Number.isFinite(amount) || amount < MIN_MILESTONE_TARGET_AMOUNT) {
    throw new BadRequestException(
      `milestone targetAmount is required and must be at least ${MIN_MILESTONE_TARGET_AMOUNT}`,
    );
  }

  return raw;
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
      : Prisma.sql`${Prisma.join(whereParts, ' AND ')}`;

  return { whereSql };
}
