import { Controller, Get, Param, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import { BillboardsService } from './billboards.service';
import { QueryBookingRequestsDto } from './dto/query-booking-requests.dto';

@Auth(Role.SUPER_ADMIN)
@Controller('admin/bookings')
export class AdminBookingRequestsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@Query() query: QueryBookingRequestsDto) {
    return this.billboardsService.findAdminBookingRequests(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billboardsService.findAdminBookingRequest(id);
  }

}
