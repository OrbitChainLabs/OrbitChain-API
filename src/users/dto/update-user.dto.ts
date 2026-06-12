import { IsString, IsOptional, MaxLength } from 'class-validator';

/** DTO for updating an authenticated user's profile fields */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  socialLinks?: string; // JSON stringified object
}
