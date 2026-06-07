import { CustomerCompanyScope } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBookingRequestDto {
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @IsOptional()
  @IsString()
  customerCompany?: string;

  @IsOptional()
  @IsString()
  customerNotes?: string;

  @IsEnum(CustomerCompanyScope)
  customerCompanyScope: CustomerCompanyScope;
}
