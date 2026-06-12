import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** DTO for suspending a campaign with a required reason */
export class SuspendCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
