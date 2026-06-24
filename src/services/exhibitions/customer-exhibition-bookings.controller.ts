import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
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

  @Post('customer/exhibition-bookings/:bookingId/commercial-registry/upload')
  uploadCommercialRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.exhibitionsService.uploadCustomerExhibitionCommercialRegistry(
      user,
      bookingId,
      request,
    );
  }
}
