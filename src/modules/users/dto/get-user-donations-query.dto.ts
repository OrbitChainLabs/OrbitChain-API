import { IsDateString, IsOptional } from 'class-validator';

export class GetUserDonationsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
