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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import type { AuthRequest } from '../common/types/auth-request.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications - Returns up to 50 notifications, optionally filtered by read status */
  @Get()
  async getNotifications(
    @Req() req: AuthRequest,
    @Query('isRead') isRead?: string,
  ) {
    const isReadFilter =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationsService.getNotifications(req.user.sub, isReadFilter);
  }

  /** PATCH /notifications/mark-read - Mark all notifications as read */
  @Patch('mark-read')
  async markAllRead(@Req() req: AuthRequest) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  /** PATCH /notifications/:id/mark-read - Mark a single notification as read */
  @Patch(':id/mark-read')
  async markOneRead(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markOneRead(req.user.sub, id);
  }
}
