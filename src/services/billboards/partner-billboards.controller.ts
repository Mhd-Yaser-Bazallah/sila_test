import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { AddBillboardMediaDto } from './dto/add-billboard-media.dto';
import { CreateBillboardDto } from './dto/create-billboard.dto';
import { CreateUnavailablePeriodDto } from './dto/create-unavailable-period.dto';
import { QueryBillboardsDto } from './dto/query-billboards.dto';
import { UpdateBillboardMediaDto } from './dto/update-billboard-media.dto';
import { UpdateBillboardDto } from './dto/update-billboard.dto';
import { UpdateUnavailablePeriodDto } from './dto/update-unavailable-period.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/billboards')
export class PartnerBillboardsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createBillboardDto: CreateBillboardDto,
  ) {
    return this.billboardsService.createPartnerBillboard(
      user,
      createBillboardDto,
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBillboardsDto,
  ) {
    return this.billboardsService.findPartnerBillboards(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findPartnerBillboard(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateBillboardDto: UpdateBillboardDto,
  ) {
    return this.billboardsService.updatePartnerBillboard(
      user,
      id,
      updateBillboardDto,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.deletePartnerBillboard(user, id);
  }

  @Patch(':id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.submitPartnerBillboard(user, id);
  }

  @Post(':id/media')
  addMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() addMediaDto: AddBillboardMediaDto,
  ) {
    return this.billboardsService.addPartnerMedia(user, id, addMediaDto);
  }

  @Post(':id/media/upload')
  uploadMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.billboardsService.uploadPartnerMedia(user, id, request);
  }

  @Get(':id/media')
  listMedia(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.listPartnerMedia(user, id);
  }

  @Patch(':id/media/:mediaId')
  updateMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @Body() updateMediaDto: UpdateBillboardMediaDto,
  ) {
    return this.billboardsService.updatePartnerMedia(
      user,
      id,
      mediaId,
      updateMediaDto,
    );
  }

  @Delete(':id/media/:mediaId')
  deleteMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.billboardsService.deletePartnerMedia(user, id, mediaId);
  }

  @Post(':id/unavailable-periods')
  createUnavailablePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() createPeriodDto: CreateUnavailablePeriodDto,
  ) {
    return this.billboardsService.createPartnerUnavailablePeriod(
      user,
      id,
      createPeriodDto,
    );
  }

  @Get(':id/unavailable-periods')
  listUnavailablePeriods(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.billboardsService.listPartnerUnavailablePeriods(user, id);
  }

  @Patch(':id/unavailable-periods/:periodId')
  updateUnavailablePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('periodId') periodId: string,
    @Body() updatePeriodDto: UpdateUnavailablePeriodDto,
  ) {
    return this.billboardsService.updatePartnerUnavailablePeriod(
      user,
      id,
      periodId,
      updatePeriodDto,
    );
  }

  @Delete(':id/unavailable-periods/:periodId')
  deleteUnavailablePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('periodId') periodId: string,
  ) {
    return this.billboardsService.deletePartnerUnavailablePeriod(
      user,
      id,
      periodId,
    );
  }
}
