import { BillboardDirection } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateRoadBillboardPackageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BillboardDirection)
  direction?: BillboardDirection;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  distanceBetweenBoards?: number;
}
