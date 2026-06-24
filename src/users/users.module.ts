import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UsersService } from './users.service';
import { UsersController, AdminUsersController } from './users.controller';
import { ExportProcessor } from './export.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { QUEUE_EXPORT } from '../queue/queue.constants';
import { AuthModule } from '../auth/auth.module';

/** Module providing user profiles, KYC management, notification prefs, and donation exports */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_EXPORT }),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, JwtAuthGuard, AdminGuard, ExportProcessor],
  exports: [UsersService],
})
export class UsersModule {}
