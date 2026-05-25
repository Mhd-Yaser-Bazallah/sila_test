import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../shared/auth/decorators/public.decorator';
import { BillboardsService } from './billboards.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { PublicQueryBillboardsDto } from './dto/public-query-billboards.dto';

@Public()
@Controller('public/billboards')
export class PublicBillboardsController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Get()
  findAll(@Query() query: PublicQueryBillboardsDto) {
    return this.billboardsService.findPublicBillboards(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billboardsService.findPublicBillboard(id);
  }

  @Get(':id/similar')
  findSimilar(
    @Param('id') id: string,
    @Query() query: PublicQueryBillboardsDto,
  ) {
    return this.billboardsService.findSimilarPublicBillboards(
      id,
      query.limitSimilar,
    );
  }

  @Get(':id/availability')
  checkAvailability(
    @Param('id') id: string,
    @Query() query: CheckAvailabilityDto,
  ) {
    return this.billboardsService.checkPublicAvailability(id, query);
  }
}
