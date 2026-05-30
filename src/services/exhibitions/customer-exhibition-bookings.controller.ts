import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { CreateExhibitionBookingDto } from './dto/create-exhibition-booking.dto';
import { QueryExhibitionBookingsDto } from './dto/query-exhibition-bookings.dto';
import { ExhibitionsService } from './exhibitions.service';

@Auth(Role.CUSTOMER)
@Controller()
export class CustomerExhibitionBookingsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Post('customer/exhibitions/:id/bookings')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') exhibitionId: string,
    @Body() createBookingDto: CreateExhibitionBookingDto,
  ) {
    return this.exhibitionsService.createCustomerBooking(
      user,
      exhibitionId,
      createBookingDto,
    );
  }

  @Get('customer/exhibition-bookings')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryExhibitionBookingsDto,
  ) {
    return this.exhibitionsService.findCustomerBookings(user, query);
  }

  @Get('customer/exhibition-bookings/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.findCustomerBooking(user, id);
  }

  @Patch('customer/exhibition-bookings/:id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.cancelCustomerBooking(user, id);
  }
}
