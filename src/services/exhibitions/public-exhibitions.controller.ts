import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../shared/auth/decorators/public.decorator';
import { QueryExhibitionsDto } from './dto/query-exhibitions.dto';
import { ExhibitionsService } from './exhibitions.service';

@Public()
@Controller('public/exhibitions')
export class PublicExhibitionsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Get()
  findAll(@Query() query: QueryExhibitionsDto) {
    return this.exhibitionsService.findPublicExhibitions(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.exhibitionsService.findPublicExhibition(slug);
  }
}
