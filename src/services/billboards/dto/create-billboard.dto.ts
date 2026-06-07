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

export class CreateBillboardDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  country: string;

  @IsString()
  province: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @Type(() => Number) 
  @IsNumber()
  width?: number;

  @Type(() => Number)
  @IsNumber()
  height?: number;

  @IsEnum(BillboardType)
  type: BillboardType;

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
  @Min(0)
  localPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  internationalPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  localFlexPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  internationalFlexPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  localStandardAddedValue?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  internationalStandardAddedValue?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

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

  @IsOptional()
  @IsBoolean()
  submitForApproval?: boolean;
}
