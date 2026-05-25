import { ServiceType } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class UpdateCompanyServicesDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(ServiceType, { each: true })
  serviceTypes: ServiceType[];
}
