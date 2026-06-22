import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CampaignsModule } from '../campaigns/campaigns.module';

/** Module providing admin campaign suspension, user moderation, and audit logging */
@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, CampaignsModule],
  controllers: [AdminController],
  providers: [AdminService, JwtAuthGuard, RolesGuard],
})
export class AdminModule {}
