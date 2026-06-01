import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_EXPORT } from '../queue/queue.constants';

export interface ExportDonationJobData {
  userId: string;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ExportDonationJobResult {
  csv: string;
  rowCount: number;
}

@Processor(QUEUE_EXPORT)
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('donation-export')
  async handleDonationExport(
    job: Job<ExportDonationJobData>,
  ): Promise<ExportDonationJobResult> {
    const { userId, campaignId, startDate, endDate } = job.data;

    this.logger.log(`Processing donation export for user ${userId}`);

    // Build where clause
    const where: {
      donorId: string;
      status: string;
      campaignId?: string;
      donatedAt?: { gte?: Date; lte?: Date };
    } = {
      donorId: userId,
      status: 'CONFIRMED',
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (startDate || endDate) {
      where.donatedAt = {};
      if (startDate) {
        where.donatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.donatedAt.lte = new Date(endDate);
      }
    }

    // Fetch all donations for this user
    const donations = await this.prisma.donation.findMany({
      where,
      include: {
        campaign: {
          select: { title: true },
        },
      },
      orderBy: { donatedAt: 'desc' },
    });

    // Build CSV
    const headers = [
      'Campaign',
      'Amount',
      'Asset',
      'Date',
      'Tx Hash',
      'USD Equivalent',
    ];
    const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

    for (const donation of donations) {
      const row = [
        `"${(donation.campaign?.title || 'Unknown').replace(/"/g, '""')}"`,
        donation.amount.toString(),
        donation.assetCode,
        donation.donatedAt.toISOString().split('T')[0],
        `"${donation.txHash || ''}"`,
        '0.00', // USD equivalent: fetched from price cache in production
      ];
      rows.push(row.join(','));
    }

    const csv = rows.join('\n');

    this.logger.log(
      `Donation export complete for user ${userId}: ${donations.length} rows`,
    );

    return { csv, rowCount: donations.length };
  }
}
