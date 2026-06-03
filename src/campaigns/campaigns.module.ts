import { Module } from '@nestjs/common';
import { CampaignsController, AdminCampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StellarModule } from '../stellar/stellar.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { DonationsModule } from '../donations/donations.module';

@Module({
  imports: [PrismaModule, AuthModule, DonationsModule, StellarModule],
  controllers: [CampaignsController, AdminCampaignsController],
  providers: [CampaignsService, JwtAuthGuard, AdminGuard],
  exports: [CampaignsService],
})
export class CampaignsModule {}
