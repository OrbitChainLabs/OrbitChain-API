import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SuspendCampaignDto } from './dtos/suspend-campaign.dto';
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
    return this.adminService.suspendCampaign(id, dto, req.user.sub, req.user.email);
  }

  /**
   * POST /admin/donations/:id/refund
   * Refund a confirmed donation, atomically updating the campaign's raisedAmount.
   * Only available to admin users.
   */
  @Post('donations/:id/refund')
  @HttpCode(HttpStatus.OK)
  async refundDonation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    id: string;
    amount: string;
    assetCode: string;
    status: string;
    campaignId: string;
    donorId: string;
    txHash: string | null;
    refundedAt: Date;
  }> {
    return this.adminService.refundDonation(id);
  }
}
