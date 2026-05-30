import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { QueryExhibitionBookingItemsDto } from './dto/query-exhibition-booking-items.dto';
import { RejectExhibitionBookingItemDto } from './dto/reject-exhibition-booking-item.dto';
import { ExhibitionsService } from './exhibitions.service';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/exhibition-booking-items')
export class PartnerExhibitionBookingItemsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryExhibitionBookingItemsDto,
  ) {
    return this.exhibitionsService.findPartnerBookingItems(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.findPartnerBookingItem(user, id);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.approvePartnerBookingItem(user, id);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() rejectDto: RejectExhibitionBookingItemDto,
  ) {
    return this.exhibitionsService.rejectPartnerBookingItem(
      user,
      id,
      rejectDto,
    );
  }
}
