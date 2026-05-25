import {
  BillboardDirection,
  BillboardStatus,
  BillboardType,
  PricingUnit,
  PrintedSubtype,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import {
  HourPricingMatchesTypeConstraint,
  PrintedSubtypeMatchesTypeConstraint,
} from './billboard-business-rules.validator';

export class RoadPackageBillboardDefaultsDto {
  @IsString()
  country: string;

  @IsString()
  province: string;

  @IsString()
  city: string;

  @IsEnum(BillboardType)
  type: BillboardType;

  @IsOptional()
  @IsEnum(PrintedSubtype)
  @Validate(PrintedSubtypeMatchesTypeConstraint)
  printedSubtype?: PrintedSubtype;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  width?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  height?: number;

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

  @IsOptional()
  @IsString()
  currency?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  taxRatePercent?: number;
}

export class RoadPackageBillboardPointDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  order: number;
}

export class CreateRoadBillboardPackageDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  startLatitude: number;

  @Type(() => Number)
  @IsNumber()
  startLongitude: number;

  @Type(() => Number)
  @IsNumber()
  endLatitude: number;

  @Type(() => Number)
  @IsNumber()
  endLongitude: number;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  billboardsCount: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  distanceBetweenBoards?: number;

  @IsEnum(BillboardDirection)
  direction: BillboardDirection;

  @IsOptional()
  @IsIn([BillboardStatus.DRAFT, BillboardStatus.PENDING_APPROVAL])
  status?: BillboardStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RoadPackageBillboardPointDto)
  billboardPoints?: RoadPackageBillboardPointDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => RoadPackageBillboardDefaultsDto)
  billboardDefaults: RoadPackageBillboardDefaultsDto;
}
