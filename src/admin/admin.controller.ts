import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminService, ReconcileOutcome } from './admin.service';
import { SuspendCampaignDto } from './dtos/suspend-campaign.dto';
import { ReconcileBalanceDto } from './dtos/reconcile-balance.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** POST /admin/campaigns/:id/suspend — Suspend a campaign (admin only) */
  @Post('campaigns/:id/suspend')
  async suspendCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendCampaignDto,
    @Request() req: any,
  ): Promise<{ message: string }> {
    return this.adminService.suspendCampaign(
      id,
      dto,
      req.user.sub,
      req.user.email,
    );
  }

  /**
   * POST /admin/campaigns/:id/reconcile-balance
   *
   * Reads the on-chain Stellar account and the APPROVED/RELEASED fund
   * releases for this campaign, then either:
   *   * reports the figures (DRY_RUN) if `body.force !== true`, or
   *   * writes the canonical `Campaign.raisedAmount = netAvailableByAssetTotal`
   *     and records an AuditLog (mode: WRITE) when `body.force === true`.
   *
   * Body: { force: boolean, reason?: string }. The endpoint is the only
   * safe path to correct a discrepancy and cannot be triggered silently.
   */
  @Post('campaigns/:id/reconcile-balance')
  async reconcileCampaignBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileBalanceDto,
    @Request() req: any,
  ): Promise<ReconcileOutcome> {
    return this.adminService.reconcileCampaignBalance(
      id,
      dto,
      req.user.sub,
      req.user.email,
    );
  }
}
