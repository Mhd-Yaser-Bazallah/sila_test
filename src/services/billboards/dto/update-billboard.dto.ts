import {
  BillboardDirection,
  BillboardType,
  PricingUnit,
  PrintedSubtype,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
} from 'class-validator';
import {
  DisplayDurationMatchesTypeConstraint,
  HourPricingMatchesTypeConstraint,
  PrintedSubtypeMatchesTypeConstraint,
} from './billboard-business-rules.validator';

export class UpdateBillboardDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

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
  @IsString()
  addressText?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  width?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsEnum(BillboardType)
  type?: BillboardType;

  @IsOptional()
  @IsEnum(BillboardDirection)
  direction?: BillboardDirection;

  @IsOptional()
  @IsEnum(PrintedSubtype)
  @Validate(PrintedSubtypeMatchesTypeConstraint)
  printedSubtype?: PrintedSubtype;

  @IsOptional()
  @IsBoolean()
  hasLighting?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  lightingPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  price?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  localPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  internationalPrice?: number;

  @IsOptional()
  @IsEnum(PricingUnit)
  @Validate(HourPricingMatchesTypeConstraint)
  pricingUnit?: PricingUnit;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  taxRatePercent?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Validate(DisplayDurationMatchesTypeConstraint)
  displayDurationSeconds?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
