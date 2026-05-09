import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUrl, Min } from 'class-validator';

export class UpdateBillboardMediaDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
