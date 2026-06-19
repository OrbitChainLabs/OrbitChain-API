import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import {
  RequestFundReleaseDto,
  FundReleaseResponseDto,
} from '../campaigns/dto/request-fund-release.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import type { AuthRequest } from '../common/types/auth-request.interface';

@Controller('campaigns/:campaignId/milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  /** POST .../:milestoneId/release - Request fund release (canonical path) */
  @UseGuards(JwtAuthGuard)
  @Post(':milestoneId/release')
  async requestFundReleaseAlias(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RequestFundReleaseDto,
    @Request() req: AuthRequest,
  ): Promise<FundReleaseResponseDto> {
    return this.milestonesService.requestFundRelease(
      campaignId,
      milestoneId,
      req.user.sub,
      dto,
    );
  }

  /** POST .../:milestoneId/fund-releases - Request fund release (legacy path) */
  @UseGuards(JwtAuthGuard)
  @Post(':milestoneId/fund-releases')
  async requestFundRelease(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RequestFundReleaseDto,
    @Request() req: AuthRequest,
  ): Promise<FundReleaseResponseDto> {
    return this.milestonesService.requestFundRelease(
      campaignId,
      milestoneId,
      req.user.sub,
      dto,
    );
  }

  /** GET fund release details by release ID */
  @Get(':milestoneId/fund-releases/:releaseId')
  async getFundRelease(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('releaseId') releaseId: string,
    @Request() req?: Partial<AuthRequest>,
  ) {
    return this.milestonesService.getFundReleaseById(releaseId, req?.user?.sub);
  }

  /** List all fund releases for a campaign, optionally scoped to creator */
  @Get('fund-releases')
  async getCampaignFundReleases(
    @Param('campaignId') campaignId: string,
    @Request() req?: Partial<AuthRequest>,
  ) {
    return this.milestonesService.getCampaignFundReleases(campaignId, req?.user?.sub);
  }

  /** Aggregate fund release stats grouped by status for a campaign */
  @Get('fund-releases/stats')
  async getFundReleaseStats(@Param('campaignId') campaignId: string) {
    return this.milestonesService.getCampaignFundReleaseStats(campaignId);
  }

  /** Cancel a pending fund release (creator only) */
  @UseGuards(JwtAuthGuard)
  @Delete(':milestoneId/fund-releases/:releaseId')
  async cancelFundRelease(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('releaseId') releaseId: string,
    @Request() req: AuthRequest,
  ) {
    return this.milestonesService.cancelFundRelease(releaseId, req.user.sub);
  }
}
