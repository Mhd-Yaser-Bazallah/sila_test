import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../shared/auth/decorators/public.decorator';
import { BillboardsService } from './billboards.service';
import { QueryOffersDto } from './dto/query-offers.dto';

@Public()
@Controller('public/offers')
export class PublicOffersController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@Query() query: QueryOffersDto) {
    return this.billboardsService.findPublicOffers(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billboardsService.findPublicOffer(id);
  }
}
