import { Body, Controller, Get, Param, Patch, Post, Req, Query } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import { BillboardsService } from './billboards.service';
import { ApproveBillboardDto } from './dto/approve-billboard.dto';
import { QueryBillboardsDto } from './dto/query-billboards.dto';
import { RejectBillboardDto } from './dto/reject-billboard.dto';

@Auth(Role.SUPER_ADMIN)
@Controller('admin/billboards')
export class AdminBillboardsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@Query() query: QueryBillboardsDto) {
    return this.billboardsService.findAdminBillboards(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billboardsService.findAdminBillboard(id);
  }

  @Get(':id/media')
  listMedia(@Param('id') id: string) {
    return this.billboardsService.listAdminMedia(id);
  }

  @Post(':id/media/upload')
  uploadMedia(@Param('id') id: string, @Req() request: FastifyRequest) {
    return this.billboardsService.uploadAdminMedia(id, request);
  }

  @Get(':id/unavailable-periods')
  listUnavailablePeriods(@Param('id') id: string) {
    return this.billboardsService.listAdminUnavailablePeriods(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    // Kept for future review metadata without changing the route signature.
    @Body() _approveBillboardDto: ApproveBillboardDto,
  ) {
    return this.billboardsService.approveBillboard(id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() rejectBillboardDto: RejectBillboardDto,
  ) {
    return this.billboardsService.rejectBillboard(id, rejectBillboardDto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.billboardsService.archiveBillboard(id);
  }
}
