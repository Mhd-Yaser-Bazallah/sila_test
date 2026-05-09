import { BillboardType, PricingUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PublicQueryBillboardsDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(BillboardType)
  type?: BillboardType;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  hasLighting?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsEnum(PricingUnit)
  pricingUnit?: PricingUnit;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  minWidth?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  maxWidth?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  minHeight?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  maxHeight?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  limitSimilar = 6;
}
