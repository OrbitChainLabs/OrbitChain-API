import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateKYCStatusDto } from './dto/update-kyc-status.dto';
import { UserProfileDto, PublicUserProfileDto } from './dto/user-profile.dto';
import {
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';
import {
  GetUserDonationsQueryDto,
  ExportDonationHistoryQueryDto,
} from './dto/get-user-donations.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import type { AuthRequest } from '../common/types/auth-request.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /users/me - Retrieve authenticated user's full profile */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@Request() req: AuthRequest): Promise<UserProfileDto> {
    return this.usersService.getMyProfile(req.user.walletAddress);
  }

  /** PATCH /users/me - Update authenticated user's profile */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMyProfile(
    @Request() req: AuthRequest,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateMyProfile(req.user.walletAddress, updateDto);
  }

  /** GET /users/me/donations - Retrieve donation history with filters */
  @UseGuards(JwtAuthGuard)
  @Get('me/donations')
  async getMyDonations(
    @Request() req: AuthRequest,
    @Query() query: GetUserDonationsQueryDto,
  ) {
    return this.usersService.getUserDonationHistory(
      req.user.sub,
      query.page,
      query.limit,
      query.sortBy,
      query.order,
      query.campaignId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /users/me/donations/export
   * Small exports (<= 500 rows) returned inline; large exports queued via Bull.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/donations/export')
  async exportMyDonations(
    @Request() req: AuthRequest,
    @Query() query: ExportDonationHistoryQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.usersService.exportUserDonationsAsCSV(
      req.user.sub,
      query.campaignId,
      query.startDate,
      query.endDate,
    );

    if (result.queued) {
      res.status(202).json({
        message: 'Export queued. Poll the status endpoint for completion.',
        jobId: result.jobId,
        statusUrl: `/users/me/donations/export/${result.jobId}/status`,
      });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
    res.status(200).send(result.csv);
  }

  /**
   * GET /users/me/donations/export/:jobId/status
   * Poll status of a queued export job.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/donations/export/:jobId/status')
  async getExportJobStatus(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.usersService.getExportJobStatus(jobId);

    if (result.status === 'completed' && result.csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
      res.status(200).send(result.csv);
      return;
    }

    res.status(200).json({ status: result.status, rowCount: result.rowCount });
  }

  /** GET /users/me/notification-preferences - Retrieve preferences */
  @UseGuards(JwtAuthGuard)
  @Get('me/notification-preferences')
  async getNotificationPreferences(
    @Request() req: AuthRequest,
  ): Promise<NotificationPreferencesDto> {
    return this.usersService.getNotificationPreferences(req.user.sub);
  }

  /** PATCH /users/me/notification-preferences - Update preferences */
  @UseGuards(JwtAuthGuard)
  @Patch('me/notification-preferences')
  async updateNotificationPreferences(
    @Request() req: AuthRequest,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return this.usersService.updateNotificationPreferences(req.user.sub, updateDto);
  }

  /** GET /users/:walletAddress - Retrieve public user profile */
  @Get(':walletAddress')
  async getPublicProfile(
    @Param('walletAddress') walletAddress: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(walletAddress);
  }
}

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * PATCH /admin/users/:id/kyc
   * Update user's KYC status (admin only)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/kyc')
  async updateKYCStatus(
    @Param('id') userId: string,
    @Body() updateDto: UpdateKYCStatusDto,
    @Request() req: AuthRequest,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.updateKYCStatus(
      userId,
      updateDto.status,
      req.user.walletAddress,
    );
  }
}
