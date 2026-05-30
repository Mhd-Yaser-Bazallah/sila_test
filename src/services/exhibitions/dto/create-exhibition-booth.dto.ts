import {
  ExhibitionBoothStatus,
  ExhibitionMapShape,
  Prisma,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExhibitionMapPointDto {
  @Type(() => Number)
  @IsNumber()
  x: number;

  @Type(() => Number)
  @IsNumber()
  y: number;
}

export class CreateExhibitionBoothDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(ExhibitionBoothStatus)
  status?: ExhibitionBoothStatus;

  @IsEnum(ExhibitionMapShape)
  shape: ExhibitionMapShape;

  @Type(() => ExhibitionMapPointDto)
  @IsArray()
  @ValidateNested({ each: true })
  coordinates: ExhibitionMapPointDto[];

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export type ExhibitionCoordinatesJson = Prisma.InputJsonValue;
