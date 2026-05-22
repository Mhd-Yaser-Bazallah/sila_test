import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { CreateRoadBillboardPackageDto } from './dto/create-road-billboard-package.dto';
import { QueryRoadBillboardPackagesDto } from './dto/query-road-billboard-packages.dto';
import { UpdateRoadBillboardPackageDto } from './dto/update-road-billboard-package.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/road-packages')
export class PartnerRoadBillboardPackagesController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createPackageDto: CreateRoadBillboardPackageDto,
  ) {
    return this.billboardsService.createPartnerRoadPackage(
      user,
      createPackageDto,
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryRoadBillboardPackagesDto,
  ) {
    return this.billboardsService.findPartnerRoadPackages(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findPartnerRoadPackage(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updatePackageDto: UpdateRoadBillboardPackageDto,
  ) {
    return this.billboardsService.updatePartnerRoadPackage(
      user,
      id,
      updatePackageDto,
    );
  }

  @Patch(':id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.submitPartnerRoadPackage(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.deletePartnerRoadPackage(user, id);
  }
}
