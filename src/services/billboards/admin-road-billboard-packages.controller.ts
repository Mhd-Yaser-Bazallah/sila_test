import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import { BillboardsService } from './billboards.service';
import { QueryRoadBillboardPackagesDto } from './dto/query-road-billboard-packages.dto';
import { RejectBillboardDto } from './dto/reject-billboard.dto';

@Auth(Role.SUPER_ADMIN)
@Controller('admin/road-packages')
export class AdminRoadBillboardPackagesController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@Query() query: QueryRoadBillboardPackagesDto) {
    return this.billboardsService.findAdminRoadPackages(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billboardsService.findAdminRoadPackage(id);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.billboardsService.approveRoadPackage(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() rejectDto: RejectBillboardDto) {
    return this.billboardsService.rejectRoadPackage(id, rejectDto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.billboardsService.archiveRoadPackage(id);
  }
}
