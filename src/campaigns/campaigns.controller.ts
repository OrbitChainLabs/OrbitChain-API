import {
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CampaignsService } from './campaigns.service';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';
import { DonationsService } from '../donations/donations.service';
import { GetCampaignDonationsQueryDto, GetCampaignDonationsResponseDto } from '../donations/dto/get-campaign-donations.dto';

const FORBIDDEN_FIELDS = [
  'goalAmount',
  'contractId',
  'milestones',
  'endDate',
];

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly donationsService: DonationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Post()
  async create(
    @Body() body: CreateCampaignDto,
    @Req() req: Request & { user: any },
  ) {
    const userId = req.user?.sub as string;
    return this.campaignsService.createCampaign(userId, body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateCampaignDto,
    @Req() req: Request & { user: any },
  ) {
    const sentKeys = Object.keys(body || {});
    const illegal = sentKeys.filter((k) => FORBIDDEN_FIELDS.includes(k));
    if (illegal.length > 0) {
      throw new BadRequestException(
        `Cannot update protected fields: ${illegal.join(', ')}`,
      );
    }

    return this.campaignsService.updateCampaign(req.user.id, id, body);
  }

  @Get()
  async browseCampaigns(
    @Query() query: BrowseCampaignsQueryDto,
  ): Promise<BrowseCampaignsResponseDto> {
    const cacheKey = this.generateCacheKey(query);

    const cached = await this.cacheManager.get<BrowseCampaignsResponseDto>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const result = await this.campaignsService.browseCampaigns(query);
    await this.cacheManager.set(cacheKey, result, 30000);

    return result;
  }

  /**
   * GET /campaigns/:campaignId/donations
   * Get paginated donations for a campaign (public leaderboard)
   */
  @Get(':campaignId/donations')
  async getCampaignDonations(
    @Param('campaignId') campaignId: string,
    @Query() query: GetCampaignDonationsQueryDto,
  ): Promise<GetCampaignDonationsResponseDto> {
    return this.donationsService.getCampaignDonations(
      campaignId,
      query.page,
      query.limit,
      query.sortBy,
      query.order,
    );
  }

  private generateCacheKey(query: BrowseCampaignsQueryDto): string {
    const parts = [
      'campaigns',
      `page:${query.page}`,
      `limit:${query.limit}`,
      `sortBy:${query.sortBy}`,
    ];

    if (query.category) parts.push(`category:${query.category}`);
    if (query.status) parts.push(`status:${query.status}`);
    if (query.search) parts.push(`search:${query.search}`);

    return parts.join(':');
  }
}
