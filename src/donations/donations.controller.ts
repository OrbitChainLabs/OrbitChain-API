import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import {
  DonationResponseDto,
  PlatformTipResponseDto,
} from './dto/donation.dto';
import { Request as ExpressRequest } from 'express';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: Request & { user: any },
    @Body() dto: CreateDonationDto,
  ) {
    const walletAddress = String(req.user?.walletAddress ?? '');
    return this.donationsService.createDonation(walletAddress, dto);
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

  @UseGuards(JwtAuthGuard)
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
