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
import { CreateBulkExhibitionBoothsDto } from './dto/create-bulk-exhibition-booths.dto';
import { CreateExhibitionBoothDto } from './dto/create-exhibition-booth.dto';
import { CreateExhibitionSectorDto } from './dto/create-exhibition-sector.dto';
import { CreateExhibitionDto } from './dto/create-exhibition.dto';
import { DeleteBulkExhibitionBoothsDto } from './dto/delete-bulk-exhibition-booths.dto';
import { QueryExhibitionBoothsDto } from './dto/query-exhibition-booths.dto';
import { QueryExhibitionSectorsDto } from './dto/query-exhibition-sectors.dto';
import { QueryExhibitionsDto } from './dto/query-exhibitions.dto';
import { UpdateBulkExhibitionBoothsDto } from './dto/update-bulk-exhibition-booths.dto';
import { UpdateExhibitionBoothDto } from './dto/update-exhibition-booth.dto';
import { UpdateExhibitionMapFilesDto } from './dto/update-exhibition-map-files.dto';
import { UpdateExhibitionSectorDto } from './dto/update-exhibition-sector.dto';
import { UpdateExhibitionDto } from './dto/update-exhibition.dto';
import { ExhibitionsService } from './exhibitions.service';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/exhibitions')
export class PartnerExhibitionsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createExhibitionDto: CreateExhibitionDto,
  ) {
    return this.exhibitionsService.createPartnerExhibition(
      user,
      createExhibitionDto,
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryExhibitionsDto,
  ) {
    return this.exhibitionsService.findPartnerExhibitions(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.findPartnerExhibition(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateExhibitionDto: UpdateExhibitionDto,
  ) {
    return this.exhibitionsService.updatePartnerExhibition(
      user,
      id,
      updateExhibitionDto,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.deletePartnerExhibition(user, id);
  }

  @Patch(':id/map-files')
  updateMapFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateMapFilesDto: UpdateExhibitionMapFilesDto,
  ) {
    return this.exhibitionsService.updatePartnerMapFiles(
      user,
      id,
      updateMapFilesDto,
    );
  }

  @Post(':id/map-files/upload')
  uploadMapFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.exhibitionsService.uploadPartnerMapFiles(user, id, request);
  }

  @Post(':id/booths')
  createBooth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() createBoothDto: CreateExhibitionBoothDto,
  ) {
    return this.exhibitionsService.createPartnerBooth(
      user,
      id,
      createBoothDto,
    );
  }

  @Post(':id/sectors')
  createSector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() createSectorDto: CreateExhibitionSectorDto,
  ) {
    return this.exhibitionsService.createPartnerSector(
      user,
      id,
      createSectorDto,
    );
  }

  @Get(':id/sectors')
  findSectors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: QueryExhibitionSectorsDto,
  ) {
    return this.exhibitionsService.findPartnerSectors(user, id, query);
  }

  @Get(':id/sectors/:sectorId')
  findSector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
  ) {
    return this.exhibitionsService.findPartnerSector(user, id, sectorId);
  }

  @Patch(':id/sectors/:sectorId')
  updateSector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
    @Body() updateSectorDto: UpdateExhibitionSectorDto,
  ) {
    return this.exhibitionsService.updatePartnerSector(
      user,
      id,
      sectorId,
      updateSectorDto,
    );
  }

  @Delete(':id/sectors/:sectorId')
  deleteSector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('sectorId') sectorId: string,
  ) {
    return this.exhibitionsService.deletePartnerSector(user, id, sectorId);
  }

  @Get(':id/booths')
  findBooths(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: QueryExhibitionBoothsDto,
  ) {
    return this.exhibitionsService.findPartnerBooths(user, id, query);
  }

  @Get(':id/booths/:boothId')
  findBooth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('boothId') boothId: string,
  ) {
    return this.exhibitionsService.findPartnerBooth(user, id, boothId);
  }

  @Post(':id/booths/bulk')
  createBoothsBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() createBulkBoothsDto: CreateBulkExhibitionBoothsDto,
  ) {
    return this.exhibitionsService.createPartnerBoothsBulk(
      user,
      id,
      createBulkBoothsDto,
    );
  }

  @Patch(':id/booths/bulk')
  updateBoothsBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateBulkBoothsDto: UpdateBulkExhibitionBoothsDto,
  ) {
    return this.exhibitionsService.updatePartnerBoothsBulk(
      user,
      id,
      updateBulkBoothsDto,
    );
  }

  @Delete(':id/booths/bulk')
  deleteBoothsBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() deleteBulkBoothsDto: DeleteBulkExhibitionBoothsDto,
  ) {
    return this.exhibitionsService.deletePartnerBoothsBulk(
      user,
      id,
      deleteBulkBoothsDto,
    );
  }

  @Patch(':id/booths/:boothId')
  updateBooth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('boothId') boothId: string,
    @Body() updateBoothDto: UpdateExhibitionBoothDto,
  ) {
    return this.exhibitionsService.updatePartnerBooth(
      user,
      id,
      boothId,
      updateBoothDto,
    );
  }

  @Delete(':id/booths/:boothId')
  deleteBooth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('boothId') boothId: string,
  ) {
    return this.exhibitionsService.deletePartnerBooth(user, id, boothId);
  }

  @Patch(':id/confirm-map')
  confirmMap(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.confirmPartnerMap(user, id);
  }

  @Patch(':id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exhibitionsService.submitPartnerExhibition(user, id);
  }
}
