import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationResponseDto, PlatformTipResponseDto } from './dto/donation.dto';
import { Request as ExpressRequest } from 'express';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createDonation(
    @Request() req: ExpressRequest & { user: any },
    @Body() dto: CreateDonationDto,
  ): Promise<{ donation: DonationResponseDto; tip: PlatformTipResponseDto | null }> {
    const userId = req.user?.sub as string;
    return this.donationsService.createDonation(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyDonations(@Request() req: ExpressRequest & { user: any }) {
    const userId = req.user?.sub as string;
    return this.donationsService.findAll(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getDonation(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    const userId = req.user?.sub as string;
    return this.donationsService.findById(id, userId);
  }

  @Post(':txHash/verify')
  async verifyDonation(
    @Param('txHash') txHash: string,
  ): Promise<{ verified: boolean; status: string }> {
    const verified = await this.donationsService.verifyDonationOnChain(txHash);

    if (!verified) {
      const tipVerified = await this.donationsService.verifyTipOnChain(txHash);
      return {
        verified: tipVerified,
        status: tipVerified ? 'CONFIRMED' : 'PENDING',
      };
    }

    return {
      verified: true,
      status: 'CONFIRMED',
    };
  }
}
