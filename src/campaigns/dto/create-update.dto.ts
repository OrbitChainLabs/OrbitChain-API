import { IsString, IsOptional, IsArray, MaxLength, IsUrl } from 'class-validator';

export class CreateUpdateDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
