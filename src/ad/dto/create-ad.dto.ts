import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { AdCategory, AdCondition } from '../ad.entity';

export class CreateAdDto {
  @IsNumber()
  userId: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(AdCategory)
  category: AdCategory;

  @IsString()
  brand: string;

  @IsEnum(AdCondition)
  condition: AdCondition;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  province: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
