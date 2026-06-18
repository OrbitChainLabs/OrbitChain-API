import { Module } from '@nestjs/common';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';

/** Module providing milestone tracking and fund release request management */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService, JwtAuthGuard],
  exports: [MilestonesService],
})
export class MilestonesModule {}
