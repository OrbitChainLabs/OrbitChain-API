import {
  Controller,
  Get,
  UseGuards,
  Request,
  ForbiddenException,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { DonationsService } from './donations.service';

@Controller('admin/tips')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminTipsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get('revenue')
  async getTipRevenue() {
    return this.donationsService.getTipRevenue();
  }

  @Get()
  async getAllTips() {
    return this.donationsService.getAllTips();
  }

  @Get(':id')
  async getTipById(@Param('id') id: string) {
    return this.donationsService.getTipById(id);
  }
}
