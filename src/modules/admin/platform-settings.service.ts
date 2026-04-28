import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditActionType } from '../../../generated/prisma';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsResponseDto } from './dto/platform-settings-response.dto';

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private settingsCache: PlatformSettingsResponseDto | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PlatformSettingsResponseDto> {
    // Check cache first
    if (this.settingsCache && Date.now() < this.cacheExpiry) {
      this.logger.debug('Returning cached platform settings');
      return this.settingsCache;
    }

    this.logger.debug('Fetching platform settings from database');
    
    let settings = await this.prisma.platformSettings.findFirst({
      include: {
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });

    // Create default settings if none exist
    if (!settings) {
      this.logger.log('No platform settings found, creating defaults');
      settings = await this.prisma.platformSettings.create({
        data: {
          minimumGoal: 100,
          platformFee: 0.05,
          maxCampaignDuration: 365
        },
        include: {
          updatedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });
    }

    const response: PlatformSettingsResponseDto = {
      minimumGoal: Number(settings.minimumGoal),
      platformFee: Number(settings.platformFee),
      maxCampaignDuration: settings.maxCampaignDuration,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedByUser?.id
    };

    // Update cache
    this.settingsCache = response;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return response;
  }

  async updateSettings(
    updateDto: UpdatePlatformSettingsDto,
    adminId: string
  ): Promise<PlatformSettingsResponseDto> {
    // Get current settings for audit
    const currentSettings = await this.getSettings();

    // Update settings
    const updatedSettings = await this.prisma.platformSettings.upsert({
      where: { id: currentSettings.id || 'default' },
      update: {
        ...updateDto,
        updatedBy: adminId
      },
      create: {
        ...updateDto,
        updatedBy: adminId
      },
      include: {
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });

    // Log the change in audit trail
    await this.logSettingsChange(currentSettings, updateDto, adminId);

    // Clear cache
    this.settingsCache = null;
    this.cacheExpiry = 0;

    const response: PlatformSettingsResponseDto = {
      minimumGoal: Number(updatedSettings.minimumGoal),
      platformFee: Number(updatedSettings.platformFee),
      maxCampaignDuration: updatedSettings.maxCampaignDuration,
      updatedAt: updatedSettings.updatedAt,
      updatedBy: updatedSettings.updatedByUser?.id
    };

    this.logger.log(`Platform settings updated by admin ${adminId}`);
    return response;
  }

  private async logSettingsChange(
    currentSettings: PlatformSettingsResponseDto,
    updateDto: UpdatePlatformSettingsDto,
    adminId: string
  ): Promise<void> {
    const changes: string[] = [];

    if (updateDto.minimumGoal !== undefined && 
        updateDto.minimumGoal !== currentSettings.minimumGoal) {
      changes.push(`minimumGoal: ${currentSettings.minimumGoal} → ${updateDto.minimumGoal}`);
    }

    if (updateDto.platformFee !== undefined && 
        updateDto.platformFee !== currentSettings.platformFee) {
      changes.push(`platformFee: ${currentSettings.platformFee} → ${updateDto.platformFee}`);
    }

    if (updateDto.maxCampaignDuration !== undefined && 
        updateDto.maxCampaignDuration !== currentSettings.maxCampaignDuration) {
      changes.push(`maxCampaignDuration: ${currentSettings.maxCampaignDuration} → ${updateDto.maxCampaignDuration}`);
    }

    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          action: AuditActionType.PLATFORM_SETTING_UPDATED,
          adminId,
          details: JSON.stringify({
            changes: changes.join(', '),
            previous: currentSettings,
            new: updateDto
          }),
          remarks: `Platform settings updated: ${changes.join(', ')}`
        }
      });

      this.logger.log(`Audit log created for settings change: ${changes.join(', ')}`);
    }
  }

  // Method to clear cache manually (useful for testing)
  clearCache(): void {
    this.settingsCache = null;
    this.cacheExpiry = 0;
    this.logger.debug('Platform settings cache cleared');
  }
}
