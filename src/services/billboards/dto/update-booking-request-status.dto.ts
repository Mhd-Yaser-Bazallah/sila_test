import { BookingRequestStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateBookingRequestStatusDto {
  @IsIn([
    BookingRequestStatus.APPROVED,
    BookingRequestStatus.REJECTED,
    BookingRequestStatus.CANCELLED,
  ])
  status: BookingRequestStatus;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
