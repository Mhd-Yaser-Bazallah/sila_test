import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { QueryBookingRequestsDto } from './dto/query-booking-requests.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/booking-requests')
export class PartnerBookingRequestsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBookingRequestsDto,
  ) {
    return this.billboardsService.findPartnerBookingRequests(user, query);
  }
}
