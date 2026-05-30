import {
  Body,
  Controller,
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

  @Post(':id/map-files/upload')
  uploadMapFiles(@Param('id') id: string, @Req() request: FastifyRequest) {
    return this.exhibitionsService.uploadAdminMapFiles(id, request);
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
}
