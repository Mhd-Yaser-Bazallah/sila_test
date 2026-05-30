import { IsOptional, IsString } from 'class-validator';

export class RejectExhibitionBookingItemDto {
  @IsOptional()
  @IsString()
  partnerNotes?: string;
}
