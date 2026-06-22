import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { SuspendCampaignDto } from './dtos/suspend-campaign.dto';
import { ReconcileBalanceDto } from './dtos/reconcile-balance.dto';

export interface ReconcileOutcome {
  campaignId: string;
  storedRaisedAmount: string;
  netAvailableByAssetTotal: string;
  onChainTotal: string;
  netReleasedAmount: string;
  discrepancyDetected: boolean;
  auditLogId: string;
  applied: boolean;
  reason?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly campaignsService: CampaignsService,
  ) {}

  /**
   * Reconcile a campaign's stored `raisedAmount` against the on-chain Stellar
   * account. This is the ONLY path that may write a corrected `raisedAmount`
   * after accounting for approved/released `FundRelease` outflows.
   *
   * `dto.force` MUST be true to perform the write. Without it, the endpoint
   * runs in dry-run mode: it returns the projected figures and an AuditLog
   * row marked DRY_RUN so admins can inspect but nothing is mutated.
   *
   * Every invocation writes an `AuditLog` row with `action = ADMIN_ACTION`
   * and `resourceType = 'campaign_balance_reconciliation'` so the trace is
   * permanent and searchable.
   */
  async reconcileCampaignBalance(
    campaignId: string,
    dto: ReconcileBalanceDto,
    adminId: string,
    adminEmail: string,
  ): Promise<ReconcileOutcome> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, contractId: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    if (!campaign.contractId) {
      throw new BadRequestException('Campaign has no contractId set');
    }

    // CampaignsService.getContractBalance is the single source of truth for
    // the canonical per-asset net figure. It never writes to the database.
    const report = await this.campaignsService.getContractBalance(campaignId);

    const applied = dto.force === true && report.discrepancyDetected;

    let auditLogId: string;
    let writtenAmount: string | null = null;

    if (applied) {
      const updated = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { raisedAmount: report.netAvailableByAssetTotal },
        select: { raisedAmount: true },
      });
      writtenAmount = updated.raisedAmount.toString();
    }

    const audit = await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_ACTION',
        resourceType: 'campaign_balance_reconciliation',
        resourceId: campaignId,
        details: JSON.stringify({
          kind: 'BALANCE_RECONCILED',
          mode: applied ? 'WRITE' : 'DRY_RUN',
          force: dto.force === true,
          reason: dto.reason ?? null,
          adminEmail,
          contractId: campaign.contractId,
          storedRaisedAmount: report.storedRaisedAmount,
          netAvailableByAssetTotal: report.netAvailableByAssetTotal,
          onChainTotal: report.onChainTotal,
          netReleasedAmount: report.netReleasedAmount,
          discrepancyDetected: report.discrepancyDetected,
          writtenAmount,
        }),
      },
    });
    auditLogId = audit.id;

    return {
      campaignId,
      storedRaisedAmount: report.storedRaisedAmount,
      netAvailableByAssetTotal: report.netAvailableByAssetTotal,
      onChainTotal: report.onChainTotal,
      netReleasedAmount: report.netReleasedAmount,
      discrepancyDetected: report.discrepancyDetected,
      auditLogId,
      applied,
      reason: dto.reason,
    };
  }

  /** Suspend a campaign with an audit log entry and creator notification */
  async suspendCampaign(
    campaignId: string,
    dto: SuspendCampaignDto,
    adminId: string,
    adminEmail: string,
  ): Promise<{ message: string }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    if (campaign.status === 'CANCELLED') {
      throw new BadRequestException('Campaign is already suspended/cancelled');
    }

    const previousStatus = campaign.status;

    // Update campaign
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_ACTION',
        resourceType: 'campaign',
        resourceId: campaignId,
        details: JSON.stringify({
          reason: dto.reason,
          previousStatus,
          action: 'CAMPAIGN_SUSPENDED',
        }),
      },
    });

    // Notify creator
    await this.notificationsService.sendCampaignSuspensionEmail({
      toEmail: `creator-${campaign.creatorId}@platform.internal`,
      campaignId,
      campaignTitle: campaign.title,
      reason: dto.reason,
    });

    return { message: `Campaign ${campaignId} has been suspended` };
  }
}
