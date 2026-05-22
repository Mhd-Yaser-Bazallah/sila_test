import { Module } from '@nestjs/common';
import { AdminOffersController } from './admin-offers.controller';
import { PrismaModule } from '../../shared/database/prisma/prisma.module';
import { NotificationsModule } from '../../shared/notifications/notifications.module';
import { AdminBillboardsController } from './admin-billboards.controller';
import { AdminBookingRequestsController } from './admin-booking-requests.controller';
import { AdminRoadBillboardPackagesController } from './admin-road-billboard-packages.controller';
import { BillboardsRepository } from './billboards.repository';
import { BillboardsService } from './billboards.service';
import { CustomerBookingRequestsController } from './customer-booking-requests.controller';
import { PartnerBookingItemsController } from './partner-booking-items.controller';
import { PartnerBookingRequestsController } from './partner-booking-requests.controller';
import { PartnerBillboardsController } from './partner-billboards.controller';
import { PartnerOffersController } from './partner-offers.controller';
import { PartnerRoadBillboardPackagesController } from './partner-road-billboard-packages.controller';
import { PublicBillboardsController } from './public-billboards.controller';
import { PublicOffersController } from './public-offers.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    PartnerBillboardsController,
    AdminBillboardsController,
    PublicBillboardsController,
    CustomerBookingRequestsController,
    AdminBookingRequestsController,
    PartnerBookingRequestsController,
    PartnerBookingItemsController,
    PartnerRoadBillboardPackagesController,
    AdminRoadBillboardPackagesController,
    PartnerOffersController,
    AdminOffersController,
    PublicOffersController,
  ],
  providers: [BillboardsService, BillboardsRepository],
  exports: [BillboardsService, BillboardsRepository],
})
export class BillboardsModule {}
