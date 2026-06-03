import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  /** Optional key to check user preferences before sending */
  preferenceKey?: string;
  userId?: string;
}

@Processor(QUEUE_EMAIL)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, preferenceKey, userId } = job.data;

    this.logger.log(`Processing email job ${job.id}: ${subject} -> ${to}`);

    // If a preference key is provided, check user's notification preferences first
    if (preferenceKey && userId) {
      const shouldSend = await this.notificationsService.shouldSendEmail(
        userId,
        preferenceKey,
      );
      if (!shouldSend) {
        this.logger.log(
          `Skipping email to ${to}: user has disabled ${preferenceKey} email notifications`,
        );
        return;
      }
    }

    await this.emailService.send({ to, subject, html });
  }
}
