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
import type { Cache } from 'cache-manager';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('auth')
/**
 * Handles JWT token invalidation (logout).
 * Client-side token removal is sufficient; server-side blacklisting is optional.
 */
@Controller('auth')
export class AuthLogoutController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token successfully invalidated',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid token',
  })
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
