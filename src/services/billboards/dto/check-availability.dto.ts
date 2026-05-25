import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';

export class CheckAvailabilityDto {
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;
}
