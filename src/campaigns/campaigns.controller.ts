import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Body,
  Req,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CampaignsService } from './campaigns.service';
import { CampaignStats } from './interfaces/campaign-stats.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';

const FORBIDDEN_FIELDS = [
  'goalAmount',
  'contractId',
  'milestones',
  'endDate',
];

@Controller('campaigns')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CampaignsController {

  @Get(':id/stats')
  @Roles('creator', 'admin')
  async getCampaignStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CampaignStats> {
    return this.campaignsService.getCampaignStats(id);
  constructor(
    private readonly campaignsService: CampaignsService,
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
