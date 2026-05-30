import { IsOptional, IsString } from 'class-validator';

export class UpdateExhibitionMapFilesDto {
  @IsOptional()
  @IsString()
  mapImageUrl?: string;

  @IsOptional()
  @IsString()
  mapPdfUrl?: string;
}
