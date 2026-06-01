import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { AdminTipsController } from './admin-tips.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DonationsController, AdminTipsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
