import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class UpdateInstallationCreativeDto {
  @ValidateIf((dto: UpdateInstallationCreativeDto) => dto.creativeImageUrl !== undefined)
  @IsUrl()
  creativeImageUrl?: string;

  @ValidateIf((dto: UpdateInstallationCreativeDto) => dto.creativeFileUrl !== undefined)
  @IsUrl()
  creativeFileUrl?: string;

  @IsOptional()
  @IsString()
  customerNotes?: string;
}
