import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';

/** Module providing WebSocket gateway, email notifications, and notification preferences */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_EMAIL }),
    AuthModule,
  ],
  providers: [
    NotificationsService,
    EmailService,
    EmailProcessor,
    NotificationsGateway,
  ],
  exports: [NotificationsService, EmailService, NotificationsGateway],
})
export class NotificationsModule {}
