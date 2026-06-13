import { InstallationUnitStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryInstallationUnitsDto {
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
  @IsEnum(InstallationUnitStatus)
  status?: InstallationUnitStatus;

  @IsOptional()
  @IsUUID()
  billboardId?: string;

  @IsOptional()
  @IsUUID()
  bookingRequestItemId?: string;

  @IsOptional()
  @IsUUID()
  installerId?: string;
}
