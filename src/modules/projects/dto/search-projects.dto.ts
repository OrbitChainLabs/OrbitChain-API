import { IsOptional, IsString, MinLength, IsEnum, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectCategory, ProjectStatus } from '../../../generated/prisma';

export class SearchProjectsDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  readonly search?: string;

  @IsOptional()
  @IsEnum(ProjectCategory)
  readonly category?: ProjectCategory;

  @IsOptional()
  @IsEnum(ProjectStatus)
  readonly status?: ProjectStatus;

  @IsOptional()
  @IsArray()
  @IsEnum(ProjectCategory, { each: true })
  readonly categories?: ProjectCategory[];

  @IsOptional()
  @IsArray()
  @IsEnum(ProjectStatus, { each: true })
  readonly statuses?: ProjectStatus[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  readonly page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  readonly limit?: number = 10;

  @IsOptional()
  @IsString()
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'goalAmount' | 'raisedAmount' | 'relevance';

  @IsOptional()
  @IsString()
  readonly sortOrder?: 'asc' | 'desc' = 'desc';
}
