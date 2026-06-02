import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Returns the last 50 notifications for the authenticated user.
   * Optionally filter by ?isRead=true|false
   */
  @Get()
  async getNotifications(
    @Req() req: Request & { user: any },
    @Query('isRead') isRead?: string,
  ) {
    const userId = req.user?.sub as string;
    const isReadFilter =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationsService.getNotifications(userId, isReadFilter);
  }

  /**
   * PATCH /notifications/mark-read
   * Marks ALL notifications for the authenticated user as read.
   */
  @Patch('mark-read')
  async markAllRead(@Req() req: Request & { user: any }) {
    const userId = req.user?.sub as string;
    return this.notificationsService.markAllRead(userId);
  }

  /**
   * PATCH /notifications/:id/mark-read
   * Marks a single notification as read.
   */
  @Patch(':id/mark-read')
  async markOneRead(
    @Req() req: Request & { user: any },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user?.sub as string;
    return this.notificationsService.markOneRead(userId, id);
  }
}
