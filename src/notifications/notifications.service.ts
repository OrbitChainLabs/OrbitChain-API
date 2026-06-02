import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SuspensionEmailPayload {
  toEmail: string;
  campaignId: string;
  campaignTitle: string;
  reason: string;
}

export interface CreateNotificationPayload {
  title: string;
  message: string;
  relatedId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an in-app notification for a user.
   */
  async create(
    userId: string,
    type: NotificationType,
    payload: CreateNotificationPayload,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title: payload.title,
        message: payload.message,
        relatedId: payload.relatedId ?? null,
      },
    });
  }

  /**
   * Fetch up to 50 notifications for the authenticated user.
   * Optionally filter by isRead. Returns unread count.
   */
  async getNotifications(userId: string, isRead?: boolean) {
    const where: { userId: string; isRead?: boolean } = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          relatedId: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data: notifications, unreadCount };
  }

  /**
   * Mark all notifications for a user as read. Returns updated unread count (0).
   */
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { unreadCount: 0 };
  }

  /**
   * Mark a single notification as read. Returns updated unread count.
   */
  async markOneRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  /**
   * Sends a suspension notice to the campaign creator.
   */
  async sendCampaignSuspensionEmail(payload: SuspensionEmailPayload): Promise<void> {
    this.logger.log(
      `[EMAIL] To: ${payload.toEmail} | Subject: Your campaign "${payload.campaignTitle}" has been suspended | Reason: ${payload.reason}`,
    );
  }
}
