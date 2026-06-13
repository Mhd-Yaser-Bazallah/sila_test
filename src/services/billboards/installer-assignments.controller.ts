import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { CreateInstallationEvidenceDto } from './dto/create-installation-evidence.dto';

@Auth(Role.INSTALLER)
@Controller('installer/assignments')
export class InstallerAssignmentsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.billboardsService.findInstallerAssignments(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findInstallerAssignment(user, id);
  }

  @Patch(':id/start')
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.startInstallerAssignment(user, id);
  }

  @Post(':id/evidence/upload')
  uploadEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.billboardsService.uploadInstallerAssignmentEvidence(
      user,
      id,
      request,
    );
  }

  @Post(':id/evidence')
  addEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() createEvidenceDto: CreateInstallationEvidenceDto,
  ) {
    return this.billboardsService.addInstallerAssignmentEvidence(
      user,
      id,
      createEvidenceDto,
    );
  }
}
