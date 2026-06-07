import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import { BillboardsService } from './billboards.service';
import { QueryOffersDto } from './dto/query-offers.dto';

@Auth(Role.SUPER_ADMIN)
@Controller('admin/offers')
export class AdminOffersController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@Query() query: QueryOffersDto) {
    return this.billboardsService.findAdminOffers(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billboardsService.findAdminOffer(id);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.billboardsService.archiveOffer(id);
  }
}
