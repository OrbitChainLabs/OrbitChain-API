import { IsEnum, IsInt, IsOptional, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../auth/types/user-role.enum';
import { KycStatus } from '../../../../generated/prisma';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
