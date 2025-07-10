import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { AdCategory, AdCondition, AdStatus } from '../ad.entity';

export class FilterAdDto {
  @IsOptional()
  @IsEnum(AdCategory)
  category?: AdCategory;

  @IsOptional()
  @IsEnum(AdCondition)
  condition?: AdCondition;

  @IsOptional()
  @IsEnum(AdStatus)
  status?: AdStatus;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 10;
}
