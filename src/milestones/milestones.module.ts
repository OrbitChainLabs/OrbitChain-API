import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService, JwtAuthGuard],
  exports: [MilestonesService],
})
export class MilestonesModule {}
