import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Body,
  Req,
  BadRequestException,
  Inject,
  UseGuards,
} from '@nestjs/common';
import Keyv from 'keyv';
import { AuthGuard } from '@nestjs/passport';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CampaignsService } from './campaigns.service';
import { CampaignStats } from './interfaces/campaign-stats.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Body } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';
import { DonationsService } from '../donations/donations.service';
import { GetCampaignDonationsQueryDto, GetCampaignDonationsResponseDto } from '../donations/dto/get-campaign-donations.dto';

const FORBIDDEN_FIELDS = [
  'goalAmount',
  'contractId',
  'acceptedAssets',
  'milestones',
  'endDate',
];

const CACHE_MANAGER = 'CACHE_MANAGER';

@Controller('campaigns')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get(':id/stats')
  @Roles('creator', 'admin')
  async getCampaignStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CampaignStats> {
    return this.campaignsService.getCampaignStats(id);
  }
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly donationsService: DonationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() body: CreateCampaignDto,
    @Req() req: Request & { user: any },
  ) {
    const userId = req.user?.sub as string;
    return this.campaignsService.createCampaign(userId, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
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

@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post(':id/feature')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async feature(@Param('id') id: string) {
    return this.campaignsService.featureCampaign(id);
  }
}
