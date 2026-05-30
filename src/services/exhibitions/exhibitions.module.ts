import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma/prisma.module';
import { NotificationsModule } from '../../shared/notifications/notifications.module';
import { AdminExhibitionBookingsController } from './admin-exhibition-bookings.controller';
import { AdminExhibitionsController } from './admin-exhibitions.controller';
import { CustomerExhibitionBookingsController } from './customer-exhibition-bookings.controller';
import { ExhibitionsRepository } from './exhibitions.repository';
import { ExhibitionsService } from './exhibitions.service';
import { PartnerExhibitionBookingItemsController } from './partner-exhibition-booking-items.controller';
import { PartnerExhibitionsController } from './partner-exhibitions.controller';
import { PublicExhibitionsController } from './public-exhibitions.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    PartnerExhibitionsController,
    CustomerExhibitionBookingsController,
    PartnerExhibitionBookingItemsController,
    AdminExhibitionsController,
    AdminExhibitionBookingsController,
    PublicExhibitionsController,
  ],
  providers: [ExhibitionsService, ExhibitionsRepository],
  exports: [ExhibitionsService, ExhibitionsRepository],
})
export class ExhibitionsModule {}
