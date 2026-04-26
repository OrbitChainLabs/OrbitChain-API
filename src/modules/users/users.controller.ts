import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { GetUserDonationsQueryDto } from './dto/get-user-donations-query.dto';

interface JwtUser {
  id: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: JwtUser) {
    return this.usersService.getUserProfile(user.id);
  }

  @Post('change-password')
  async changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // Issue #141
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.usersService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(dto.token, dto.newPassword);
  }

  // Issue #142
  @Post('kyc/submit')
  async submitKyc(@CurrentUser() user: JwtUser, @Body() dto: SubmitKycDto) {
    return this.usersService.submitKyc(user.id, dto.documentUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Get('donations')
  async getDonationHistory(
    @CurrentUser() user: JwtUser,
    @Query() query: GetUserDonationsQueryDto,
  ) {
    return this.usersService.getUserDonationHistory(user.id, query);
  }
}
