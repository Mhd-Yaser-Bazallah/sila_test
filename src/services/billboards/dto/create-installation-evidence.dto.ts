import { InstallationEvidenceType } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class InstallationEvidenceItemDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsEnum(InstallationEvidenceType)
  type?: InstallationEvidenceType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInstallationEvidenceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstallationEvidenceItemDto)
  items: InstallationEvidenceItemDto[];
}
