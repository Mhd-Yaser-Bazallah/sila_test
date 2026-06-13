import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { CreateInstallerDto } from './dto/create-installer.dto';
import { UpdateInstallerDto } from './dto/update-installer.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/installers')
export class PartnerInstallersController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createInstallerDto: CreateInstallerDto,
  ) {
    return this.billboardsService.createPartnerInstaller(user, createInstallerDto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.billboardsService.findPartnerInstallers(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findPartnerInstaller(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateInstallerDto: UpdateInstallerDto,
  ) {
    return this.billboardsService.updatePartnerInstaller(
      user,
      id,
      updateInstallerDto,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.deletePartnerInstaller(user, id);
  }
}
