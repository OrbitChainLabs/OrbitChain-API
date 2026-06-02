import { Module } from '@nestjs/common';
import { AdminCampaignsController, CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CampaignsController, AdminCampaignsController],
  providers: [CampaignsService, JwtAuthGuard, AdminGuard],
  exports: [CampaignsService],
  
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { Donation } from '../donations/entities/donation.entity';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DonationsModule } from '../donations/donations.module';
import { CampaignsController } from './campaigns.controller';


@Module({
  imports: [],

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Donation]), PrismaModule, DonationsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
