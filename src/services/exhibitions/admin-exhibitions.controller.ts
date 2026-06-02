import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import { QueryExhibitionBoothsDto } from './dto/query-exhibition-booths.dto';
import { QueryExhibitionsDto } from './dto/query-exhibitions.dto';
import { RejectExhibitionDto } from './dto/reject-exhibition.dto';
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
}
