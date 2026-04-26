import { Controller, Get, Post, Body, Param, UseGuards, Headers, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { WebhookDto } from './dto/webhook.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../../generated/prisma';

interface JwtUser {
  id: string;
  role: UserRole;
}

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDonationDto) {
    return this.donationsService.create(user.id, dto);
  }

  @Get()
  findAll() {
    return this.donationsService.findAll();
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.donationsService.findByProject(projectId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Headers('signature') signature: string, @Body() dto: WebhookDto) {
    return this.donationsService.processWebhook(dto, signature);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('scope') scope: string = 'global',
    @Query('projectId') projectId?: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0
  ) {
    return this.donationsService.getLeaderboard(scope, projectId, limit, offset);
  }
}