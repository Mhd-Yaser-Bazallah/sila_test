import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateUnavailablePeriodDto {
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsString()
  reason?: string;
}
