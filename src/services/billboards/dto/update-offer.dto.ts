import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateOfferDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  startsAt?: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  endsAt?: Date;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  discountedTotalPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  billboardIds?: string[];
}
