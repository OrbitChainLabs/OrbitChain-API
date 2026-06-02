import { Module } from '@nestjs/common';
import { AdminCampaignsController, CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { DonationsModule } from '../donations/donations.module';

@Module({
  imports: [PrismaModule, AuthModule, DonationsModule],
  controllers: [CampaignsController, AdminCampaignsController],
  providers: [CampaignsService, JwtAuthGuard, AdminGuard],
  exports: [CampaignsService],
})
export class CampaignsModule {}
