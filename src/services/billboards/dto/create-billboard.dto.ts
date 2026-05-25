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
  IsNumber,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import {
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
  price?: number;

  @IsOptional()
  @IsEnum(PricingUnit)
  @Validate(HourPricingMatchesTypeConstraint)
  pricingUnit?: PricingUnit;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  taxRatePercent?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  submitForApproval?: boolean;
}
