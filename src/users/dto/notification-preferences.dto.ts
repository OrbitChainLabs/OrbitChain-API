import { IsOptional, IsBoolean, IsString } from 'class-validator';

/**
 * Toggle for a single notification type on a specific channel.
 */
export class NotificationChannelPreferenceDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;
}

/**
 * Full notification preferences structure.
 */
export class NotificationPreferencesDto {
  donationReceived?: NotificationChannelPreferenceDto;
  milestoneUnlocked?: NotificationChannelPreferenceDto;
  campaignUpdate?: NotificationChannelPreferenceDto;
  campaignCreated?: NotificationChannelPreferenceDto;
  campaignCompleted?: NotificationChannelPreferenceDto;
}

/**
 * DTO for PATCH /users/me/notification-preferences.
 */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  donationReceived?: NotificationChannelPreferenceDto;

  @IsOptional()
  milestoneUnlocked?: NotificationChannelPreferenceDto;

  @IsOptional()
  campaignUpdate?: NotificationChannelPreferenceDto;

  @IsOptional()
  campaignCreated?: NotificationChannelPreferenceDto;

  @IsOptional()
  campaignCompleted?: NotificationChannelPreferenceDto;
}
