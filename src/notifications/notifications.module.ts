import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_EMAIL }),
  ],
  providers: [NotificationsService, EmailService, EmailProcessor],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
