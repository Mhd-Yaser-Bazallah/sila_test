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
import { Role } from '../../shared/auth/enums/role.enum';
import { CreateExhibitionBoothDto } from './dto/create-exhibition-booth.dto';
import { QueryExhibitionBoothsDto } from './dto/query-exhibition-booths.dto';
import { QueryExhibitionsDto } from './dto/query-exhibitions.dto';
import { RejectExhibitionDto } from './dto/reject-exhibition.dto';
import { UpdateExhibitionBoothDto } from './dto/update-exhibition-booth.dto';
import { ExhibitionsService } from './exhibitions.service';

@Auth(Role.SUPER_ADMIN)
@Controller('admin/exhibitions')
export class AdminExhibitionsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Get()
  findAll(@Query() query: QueryExhibitionsDto) {
    return this.exhibitionsService.findAdminExhibitions(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exhibitionsService.findAdminExhibition(id);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.exhibitionsService.approveExhibition(id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() rejectExhibitionDto: RejectExhibitionDto,
  ) {
    return this.exhibitionsService.rejectExhibition(id, rejectExhibitionDto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.exhibitionsService.archiveExhibition(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.exhibitionsService.deleteAdminExhibition(id);
  }

  @Post(':id/map-files/upload')
  uploadMapFiles(@Param('id') id: string, @Req() request: FastifyRequest) {
    return this.exhibitionsService.uploadAdminMapFiles(id, request);
  }

  @Post(':id/booths')
  createBooth(
    @Param('id') id: string,
    @Body() createBoothDto: CreateExhibitionBoothDto,
  ) {
    return this.exhibitionsService.createAdminBooth(id, createBoothDto);
  }

  @Get(':id/booths')
  findBooths(
    @Param('id') id: string,
    @Query() query: QueryExhibitionBoothsDto,
  ) {
    return this.exhibitionsService.findAdminBooths(id, query);
  }

  @Get(':id/booths/:boothId')
  findBooth(
    @Param('id') id: string,
    @Param('boothId') boothId: string,
  ) {
    return this.exhibitionsService.findAdminBooth(id, boothId);
  }

  @Patch(':id/booths/:boothId')
  updateBooth(
    @Param('id') id: string,
    @Param('boothId') boothId: string,
    @Body() updateBoothDto: UpdateExhibitionBoothDto,
  ) {
    return this.exhibitionsService.updateAdminBooth(
      id,
      boothId,
      updateBoothDto,
    );
  }

  @Delete(':id/booths/:boothId')
  deleteBooth(
    @Param('id') id: string,
    @Param('boothId') boothId: string,
  ) {
    return this.exhibitionsService.deleteAdminBooth(id, boothId);
  }
}
