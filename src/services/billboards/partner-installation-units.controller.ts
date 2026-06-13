import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { AssignInstallersDto } from './dto/assign-installers.dto';
import { QueryInstallationUnitsDto } from './dto/query-installation-units.dto';
import { RequestInstallationRevisionDto } from './dto/request-installation-revision.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/installation-units')
export class PartnerInstallationUnitsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryInstallationUnitsDto,
  ) {
    return this.billboardsService.findPartnerInstallationUnits(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findPartnerInstallationUnit(user, id);
  }

  @Post(':unitId/assignments')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId') unitId: string,
    @Body() assignInstallersDto: AssignInstallersDto,
  ) {
    return this.billboardsService.assignInstallationUnitInstallers(
      user,
      unitId,
      assignInstallersDto,
    );
  }

  @Patch(':unitId/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('unitId') unitId: string) {
    return this.billboardsService.approveInstallationUnit(user, unitId);
  }

  @Patch(':unitId/request-revision')
  requestRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId') unitId: string,
    @Body() requestRevisionDto: RequestInstallationRevisionDto,
  ) {
    return this.billboardsService.requestInstallationUnitRevision(
      user,
      unitId,
      requestRevisionDto,
    );
  }
}
