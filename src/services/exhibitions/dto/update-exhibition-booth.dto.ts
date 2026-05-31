import { ExhibitionBoothStatus, ExhibitionMapShape } from '@prisma/client';
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
import { ExhibitionMapPointDto } from './create-exhibition-booth.dto';

export class UpdateExhibitionBoothDto {
  @IsOptional()
  @IsString()
  sectorId?: string | null;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(ExhibitionBoothStatus)
  status?: ExhibitionBoothStatus;

  @IsOptional()
  @IsEnum(ExhibitionMapShape)
  shape?: ExhibitionMapShape;

  @Type(() => ExhibitionMapPointDto)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  coordinates?: ExhibitionMapPointDto[];

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
