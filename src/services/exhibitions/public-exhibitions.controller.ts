import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
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

  @Get(':slug/map/image')
  async downloadMapImage(
    @Param('slug') slug: string,
    @Res() reply: FastifyReply,
  ) {
    const url = await this.exhibitionsService.findPublicExhibitionMapImageUrl(
      slug,
    );

    return reply.redirect(url);
  }

  @Get(':slug/map/pdf')
  async downloadMapPdf(
    @Param('slug') slug: string,
    @Res() reply: FastifyReply,
  ) {
    const url = await this.exhibitionsService.findPublicExhibitionMapPdfUrl(
      slug,
    );

    return reply.redirect(url);
  }

  @Get(':slug/map/download')
  async downloadMap(
    @Param('slug') slug: string,
    @Res() reply: FastifyReply,
  ) {
    const url = await this.exhibitionsService.findPublicExhibitionMapDownloadUrl(
      slug,
    );

    return reply.redirect(url);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.exhibitionsService.findPublicExhibition(slug);
  }
}
