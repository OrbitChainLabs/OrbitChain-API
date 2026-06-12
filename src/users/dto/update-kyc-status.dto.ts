import { IsEnum } from 'class-validator';

export enum KYCStatusEnum {
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
}

/** DTO for admin KYC status updates */
export class UpdateKYCStatusDto {
  @IsEnum(KYCStatusEnum)
  status: KYCStatusEnum;
}
