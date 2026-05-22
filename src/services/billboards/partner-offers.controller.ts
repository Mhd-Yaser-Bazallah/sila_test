import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../../shared/auth/decorators/auth.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Role } from '../../shared/auth/enums/role.enum';
import type { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { BillboardsService } from './billboards.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

@Auth(Role.COMPANY_ADMIN)
@Controller('partner/offers')
export class PartnerOffersController {
  constructor(private readonly billboardsService: BillboardsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createOfferDto: CreateOfferDto,
  ) {
    return this.billboardsService.createPartnerOffer(user, createOfferDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryOffersDto,
  ) {
    return this.billboardsService.findPartnerOffers(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.findPartnerOffer(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateOfferDto: UpdateOfferDto,
  ) {
    return this.billboardsService.updatePartnerOffer(user, id, updateOfferDto);
  }

  @Patch(':id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.submitPartnerOffer(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.billboardsService.deletePartnerOffer(user, id);
  }
}
