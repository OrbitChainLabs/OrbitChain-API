import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, CampaignStatus } from '../campaigns/entities/campaign.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SuspendCampaignDto } from './dtos/suspend-campaign.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Suspend a campaign with an audit log entry and creator notification */
  async suspendCampaign(
    campaignId: string,
    dto: SuspendCampaignDto,
    adminId: string,
    adminEmail: string,
  ): Promise<{ message: string }> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    if (campaign.status === CampaignStatus.SUSPENDED) {
      throw new BadRequestException('Campaign is already suspended');
    }

    const previousStatus = campaign.status;

    // Update campaign
    campaign.status = CampaignStatus.SUSPENDED;
    campaign.suspensionReason = dto.reason;
    await this.campaignRepo.save(campaign);

    // Write audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        action: 'CAMPAIGN_SUSPENDED',
        actorId: adminId,
        targetType: 'campaign',
        targetId: campaignId,
        metadata: {
          reason: dto.reason,
          previousStatus,
        },
      }),
    );

    // Notify creator — we use creatorId as a stand-in email key until a Users
    // table is wired up; swap for a real lookup when available.
    await this.notificationsService.sendCampaignSuspensionEmail({
      toEmail: `creator-${campaign.creatorId}@platform.internal`,
      campaignId,
      campaignTitle: campaign.title,
      reason: dto.reason,
    });

    return { message: `Campaign ${campaignId} has been suspended` };
  }
}
