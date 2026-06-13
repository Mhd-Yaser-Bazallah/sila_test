import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { UpdateInstallationCreativeDto } from './dto/update-installation-creative.dto';

@Auth(Role.CUSTOMER)
@Controller()
export class CustomerInstallationUnitsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get('customer/bookings/:bookingId/installation-units')
  findForBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.billboardsService.findCustomerInstallationUnits(user, bookingId);
  }

  @Post('customer/installation-units/:unitId/creative/upload')
  uploadCreative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId') unitId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.billboardsService.uploadCustomerInstallationCreative(
      user,
      unitId,
      request,
    );
  }

  @Patch('customer/installation-units/:unitId/creative')
  updateCreative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId') unitId: string,
    @Body() updateCreativeDto: UpdateInstallationCreativeDto,
  ) {
    return this.billboardsService.updateCustomerInstallationCreative(
      user,
      unitId,
      updateCreativeDto,
    );
  }
}
