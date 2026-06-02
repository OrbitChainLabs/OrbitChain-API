import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_EMAIL }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'stellaraid-default-secret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [NotificationsService, EmailService, EmailProcessor, NotificationsGateway],
  exports: [NotificationsService, EmailService, NotificationsGateway],
})
export class NotificationsModule {}
