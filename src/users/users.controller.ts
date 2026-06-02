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
import { NotificationPreferencesDto, UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { GetUserDonationsQueryDto, GetUserDonationsResponseDto, ExportDonationHistoryQueryDto } from './dto/get-user-donations.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me
   * Retrieve authenticated user's full profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@Request() req: any): Promise<UserProfileDto> {
    return this.usersService.getMyProfile(req.user.walletAddress);
  }

  /**
   * PATCH /users/me
   * Update authenticated user's profile
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMyProfile(
    @Request() req: any,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateMyProfile(req.user.walletAddress, updateDto);
  }

  /**
   * GET /users/me/donations
   * Retrieve authenticated user's donation history with filters and sorting
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/donations')
  async getMyDonations(
    @Request() req: any,
    @Query() query: GetUserDonationsQueryDto,
  ): Promise<GetUserDonationsResponseDto> {
    const userId = req.user?.sub as string;
    return this.usersService.getUserDonationHistory(
      userId,
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
   * Export user's donation history as CSV.
   * Small exports (<= 500 rows) are returned inline.
   * Large exports are queued via Bull; a jobId is returned for polling.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/donations/export')
  async exportMyDonations(
    @Request() req: any,
    @Query() query: ExportDonationHistoryQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.user?.sub as string;
    const result = await this.usersService.exportUserDonationsAsCSV(
      userId,
      query.campaignId,
      query.startDate,
      query.endDate,
    );

    if (result.queued) {
      // Large export — return 202 Accepted with jobId for polling
      res.status(202).json({
        message: 'Export queued. Poll the status endpoint for completion.',
        jobId: result.jobId,
        statusUrl: `/users/me/donations/export/${result.jobId}/status`,
      });
      return;
    }

    // Small export — return CSV inline
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
    res.status(200).send(result.csv);
  }

  /**
   * GET /users/me/donations/export/:jobId/status
   * Poll the status of a queued export job.
   * Returns the CSV when the job is complete.
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

  /**
   * GET /users/me/notification-preferences
   * Retrieve authenticated user's notification preferences
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/notification-preferences')
  async getNotificationPreferences(
    @Request() req: any,
  ): Promise<NotificationPreferencesDto> {
    return this.usersService.getNotificationPreferences(req.user.sub);
  }

  /**
   * PATCH /users/me/notification-preferences
   * Update authenticated user's notification preferences
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me/notification-preferences')
  async updateNotificationPreferences(
    @Request() req: any,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return this.usersService.updateNotificationPreferences(
      req.user.sub,
      updateDto,
    );
  }

  /**
   * GET /users/:walletAddress
   * Retrieve public profile for a user by wallet address
   */
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
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.updateKYCStatus(
      userId,
      updateDto.status as 'VERIFIED' | 'REJECTED' | 'PENDING',
      req.user.walletAddress,
    );
  }
}
