import { ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCompanyPrimaryAdminDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateCompanyWithAdminDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ServiceType, { each: true })
  serviceTypes?: ServiceType[];

  @IsDefined()
  @ValidateNested()
  @Type(() => CreateCompanyPrimaryAdminDto)
  admin: CreateCompanyPrimaryAdminDto;
}
