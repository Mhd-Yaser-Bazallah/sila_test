import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOfferDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @Type(() => Date)
  @IsDate()
  endsAt: Date;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  discountedTotalPrice?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  localDiscountedTotalPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  internationalDiscountedTotalPrice: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  billboardIds: string[];

  @IsOptional()
  @IsBoolean()
  submitForApproval?: boolean;
}
