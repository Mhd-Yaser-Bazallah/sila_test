import { IsOptional, IsString } from 'class-validator';

export class RejectBookingItemDto {
  @IsOptional()
  @IsString()
  partnerNotes?: string;
}
