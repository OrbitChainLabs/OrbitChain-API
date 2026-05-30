import {
  Controller,
  Post,
  Req,
  UnauthorizedException,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import Keyv from 'keyv';

@ApiTags('auth')
@Controller('auth')
export class AuthLogoutController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Keyv) {}

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Token successfully invalidated' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid token' })
  async logout(@Req() req: Request): Promise<void> {
    const user = req['user'];

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    const walletAddress = user.walletAddress;
    if (walletAddress) {
      await this.cacheManager.del(`refresh:${walletAddress}`);
    }
  }
}