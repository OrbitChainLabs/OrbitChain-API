import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CampaignsService } from './campaigns.service';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Body, Post } from '@nestjs/common';

const FORBIDDEN_FIELDS = [
  'goalAmount',
  'contractId',
  'milestones',
  'endDate',
];
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  async create(
    @Body() body: CreateCampaignDto,
    @Req() req: Request & { user: any },
  ) {
    const userId = req.user?.sub as string;
    return this.campaigns.createCampaign(userId, body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateCampaignDto,
    @Req() req: Request & { user: any },
  ) {
    // Reject attempts to update forbidden fields
    const sentKeys = Object.keys(body || {});
    const illegal = sentKeys.filter((k) => FORBIDDEN_FIELDS.includes(k));
    if (illegal.length > 0) {
      throw new BadRequestException(
        `Cannot update protected fields: ${illegal.join(', ')}`,
      );
  constructor(
    private readonly campaignsService: CampaignsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * GET /campaigns
   * Browse public campaigns with pagination, filtering, and sorting
   * Query params: page, limit, category, status, search, sortBy
   * Cached for 30 seconds
   */
  @Get()
  async browseCampaigns(
    @Query() query: BrowseCampaignsQueryDto,
  ): Promise<BrowseCampaignsResponseDto> {
    // Generate cache key based on query parameters
    const cacheKey = this.generateCacheKey(query);

    // Try to get from cache
    const cached = await this.cacheManager.get<BrowseCampaignsResponseDto>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    // If not cached, fetch from service
    const result = await this.campaignsService.browseCampaigns(query);

    // Cache the result for 30 seconds
    await this.cacheManager.set(cacheKey, result, 30000);

    return result;
  }

  /**
   * Generate a cache key based on query parameters
   */
  private generateCacheKey(query: BrowseCampaignsQueryDto): string {
    const parts = [
      'campaigns',
      `page:${query.page}`,
      `limit:${query.limit}`,
      `sortBy:${query.sortBy}`,
    ];

    if (query.category) {
      parts.push(`category:${query.category}`);
    }

    if (query.status) {
      parts.push(`status:${query.status}`);
    }

    if (query.search) {
      parts.push(`search:${query.search}`);
    }

    return parts.join(':');
  }
}
