import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { QueryBookingRequestsDto } from './dto/query-booking-requests.dto';

@Auth(Role.CUSTOMER)
@Controller()
export class CustomerBookingRequestsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Post('customer/billboards/:id/booking-requests')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') billboardId: string,
    @Body() createBookingDto: CreateBookingRequestDto,
  ) {
    return this.billboardsService.createCustomerBookingRequest(
      user,
      billboardId,
      createBookingDto,
    );
  }

  @Get('customer/booking-requests')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBookingRequestsDto,
  ) {
    return this.billboardsService.findCustomerBookingRequests(user, query);
  }

  @Get('customer/booking-requests/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findCustomerBookingRequest(user, id);
  }

  @Patch('customer/booking-requests/:id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.cancelCustomerBookingRequest(user, id);
  }
}
