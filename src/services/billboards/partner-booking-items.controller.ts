import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { QueryBookingItemsDto } from './dto/query-booking-items.dto';
import { RejectBookingItemDto } from './dto/update-booking-item-status.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/booking-items')
export class PartnerBookingItemsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBookingItemsDto,
  ) {
    return this.billboardsService.findPartnerBookingItems(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findPartnerBookingItem(user, id);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.approvePartnerBookingItem(user, id);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() rejectDto: RejectBookingItemDto,
  ) {
    return this.billboardsService.rejectPartnerBookingItem(user, id, rejectDto);
  }
}
