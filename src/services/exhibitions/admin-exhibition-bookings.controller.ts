import { Controller, Get, Param, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import { QueryExhibitionBookingsDto } from './dto/query-exhibition-bookings.dto';
import { ExhibitionsService } from './exhibitions.service';

@Auth(Role.SUPER_ADMIN)
@Controller('admin/exhibition-bookings')
export class AdminExhibitionBookingsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Get()
  findAll(@Query() query: QueryExhibitionBookingsDto) {
    return this.exhibitionsService.findAdminBookings(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exhibitionsService.findAdminBooking(id);
  }
}
