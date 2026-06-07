import { CustomerCompanyScope, CustomerSector } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateExhibitionBookingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  boothIds: string[];

  @IsOptional()
  @IsString()
  customerCompany?: string;

  @IsOptional()
  @IsString()
  customerNotes?: string;

  @IsEnum(CustomerCompanyScope)
  customerCompanyScope: CustomerCompanyScope;

  @IsOptional()
  @IsEnum(CustomerSector)
  customerSector?: CustomerSector;
}
