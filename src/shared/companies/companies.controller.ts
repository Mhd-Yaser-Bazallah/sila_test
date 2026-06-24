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
import { Role } from '../auth/enums/role.enum';
import { Auth } from '../auth/decorators/auth.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithAdminDto } from './dto/create-company-with-admin.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyLogoDto } from './dto/update-company-logo.dto';
import { UpdateCompanyServicesDto } from './dto/update-company-services.dto';

@Auth(Role.SUPER_ADMIN)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Post('with-admin')
  createWithAdmin(
    @Body() createCompanyWithAdminDto: CreateCompanyWithAdminDto,
  ) {
    return this.companiesService.createWithAdmin(createCompanyWithAdminDto);
  }

  @Get()
  findAll(@Query() query: QueryCompaniesDto) {
    return this.companiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Post(':id/logo/upload')
  uploadLogo(@Param('id') id: string, @Req() request: FastifyRequest) {
    return this.companiesService.uploadLogo(id, request);
  }

  @Patch(':id/logo')
  updateLogo(
    @Param('id') id: string,
    @Body() updateLogoDto: UpdateCompanyLogoDto,
  ) {
    return this.companiesService.updateLogo(id, updateLogoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  @Patch(':id/services')
  updateServices(
    @Param('id') id: string,
    @Body() updateCompanyServicesDto: UpdateCompanyServicesDto,
  ) {
    return this.companiesService.updateServices(id, updateCompanyServicesDto);
  }
}
