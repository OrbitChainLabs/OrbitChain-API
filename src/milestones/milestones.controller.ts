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
import { RequestFundReleaseDto, FundReleaseResponseDto } from '../campaigns/dto/request-fund-release.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';

@Controller('campaigns/:campaignId/milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  /**
   * POST /campaigns/:campaignId/milestones/:milestoneId/release
   * Request fund release for an unlocked milestone (issue #272 canonical path)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':milestoneId/release')
  async requestFundReleaseAlias(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RequestFundReleaseDto,
    @Request() req: any,
  ): Promise<FundReleaseResponseDto> {
    const creatorId = req.user?.sub as string;
    return this.milestonesService.requestFundRelease(
      campaignId,
      milestoneId,
      creatorId,
      dto,
    );
  }

  /**
   * POST /campaigns/:campaignId/milestones/:milestoneId/fund-releases
   * Request fund release for an unlocked milestone (legacy path, kept for compat)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':milestoneId/fund-releases')
  async requestFundRelease(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RequestFundReleaseDto,
    @Request() req: any,
  ): Promise<FundReleaseResponseDto> {
    const creatorId = req.user?.sub as string;
    return this.milestonesService.requestFundRelease(
      campaignId,
      milestoneId,
      creatorId,
      dto,
    );
  }

  /**
   * GET /campaigns/:campaignId/milestones/:milestoneId/fund-releases/:releaseId
   * Get fund release details
   */
  @Get(':milestoneId/fund-releases/:releaseId')
  async getFundRelease(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('releaseId') releaseId: string,
    @Request() req?: any,
  ) {
    const userId = req?.user?.sub;
    return this.milestonesService.getFundReleaseById(releaseId, userId);
  }

  /**
   * GET /campaigns/:campaignId/milestones/fund-releases
   * Get all fund releases for a campaign
   */
  @Get('fund-releases')
  async getCampaignFundReleases(
    @Param('campaignId') campaignId: string,
    @Request() req?: any,
  ) {
    const creatorId = req?.user?.sub;
    return this.milestonesService.getCampaignFundReleases(campaignId, creatorId);
  }

  /**
   * GET /campaigns/:campaignId/milestones/fund-releases/stats
   * Get fund release statistics for a campaign
   */
  @Get('fund-releases/stats')
  async getFundReleaseStats(@Param('campaignId') campaignId: string) {
    return this.milestonesService.getCampaignFundReleaseStats(campaignId);
  }

  /**
   * DELETE /campaigns/:campaignId/milestones/:milestoneId/fund-releases/:releaseId
   * Cancel a pending fund release
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':milestoneId/fund-releases/:releaseId')
  async cancelFundRelease(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('releaseId') releaseId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.sub as string;
    return this.milestonesService.cancelFundRelease(releaseId, userId);
  }
}
