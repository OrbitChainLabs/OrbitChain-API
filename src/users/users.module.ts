import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { UsersService } from './users.service';
import { UsersController, AdminUsersController } from './users.controller';
import { ExportProcessor } from './export.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { QUEUE_EXPORT } from '../queue/queue.constants';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    BullModule.registerQueue({ name: QUEUE_EXPORT }),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, JwtAuthGuard, AdminGuard, ExportProcessor],
  exports: [UsersService],
})
export class UsersModule {}
