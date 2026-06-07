import {
  BookingItemType,
  CustomerCompanyScope,
  CustomerSector,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateBookingItemDto {
  @IsEnum(BookingItemType)
  itemType: BookingItemType;

  @ValidateIf((item: CreateBookingItemDto) => item.itemType === BookingItemType.BILLBOARD)
  @IsUUID()
  billboardId?: string;

  @ValidateIf((item: CreateBookingItemDto) => item.itemType === BookingItemType.ROAD_PACKAGE)
  @IsUUID()
  roadPackageId?: string;

  @ValidateIf((item: CreateBookingItemDto) => item.itemType === BookingItemType.OFFER)
  @IsUUID()
  offerId?: string;

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;
}

export class CreateMultiBookingRequestDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingItemDto)
  items: CreateBookingItemDto[];

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
