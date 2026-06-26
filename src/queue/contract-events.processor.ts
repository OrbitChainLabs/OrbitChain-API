import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_CONTRACT_EVENTS } from './queue.constants';

interface ContractEventJob {
  contractId: string;
  eventType: string;
  topics: string[];
  value: unknown;
  ledger: number;
  txHash: string;
  pagingToken: string;
  createdAt: string;
}

@Processor(QUEUE_CONTRACT_EVENTS)
export class ContractEventsProcessor {
  private readonly logger = new Logger(ContractEventsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('process-event')
  async processEvent(job: Job<ContractEventJob>) {
    const { txHash, eventType } = job.data;

    const existing = await this.prisma.processedEvent.findUnique({
      where: { txHash_eventType: { txHash, eventType } },
    });
    if (existing) {
      this.logger.log(
        `Skipping duplicate event [${eventType}] txHash=${txHash} — already processed at ${existing.processedAt.toISOString()}`,
      );
      return { skipped: true, reason: 'duplicate' };
    }

    try {
      await this.handleEvent(job.data);

      await this.prisma.processedEvent.create({
        data: { txHash, eventType },
      });

      this.logger.log(
        `Processed event [${eventType}] txHash=${txHash} contractId=${job.data.contractId}`,
      );
      return { processed: true };
    } catch (err) {
      this.logger.error(
        `Failed to process event [${eventType}] txHash=${txHash}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  private async handleEvent(data: ContractEventJob) {
    const { eventType, topics, value, contractId, txHash } = data;

    switch (eventType) {
      case 'DonationReceived': {
        const donorAddress = topics[1] as string | undefined;
        if (!donorAddress) {
          this.logger.warn(
            `DonationReceived tx=${txHash}: no donor address in topics`,
          );
          break;
        }
        const amount =
          typeof value === 'object' && value !== null && 'amount' in value
            ? Number((value as Record<string, unknown>).amount)
            : undefined;

        await this.prisma.donation.updateMany({
          where: { txHash, status: 'PENDING' },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });

        this.logger.log(
          `Confirmed donation tx=${txHash} ${amount ? `amount=${amount} ` : ''}donor=${donorAddress}`,
        );
        break;
      }

      case 'MilestoneReleased':
        await this.prisma.milestone.updateMany({
          where: { txHash, status: 'PENDING' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        this.logger.log(`Completed milestone tx=${txHash}`);
        break;

      default:
        this.logger.warn(
          `Unknown event type "${eventType}" in tx=${txHash} — no handler registered`,
        );
    }
  }
}
