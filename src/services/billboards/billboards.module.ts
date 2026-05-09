import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma/prisma.module';
import { NotificationsModule } from '../../shared/notifications/notifications.module';
import { AdminBillboardsController } from './admin-billboards.controller';
import { AdminBookingRequestsController } from './admin-booking-requests.controller';
import { BillboardsRepository } from './billboards.repository';
import { BillboardsService } from './billboards.service';
import { CustomerBookingRequestsController } from './customer-booking-requests.controller';
import { PartnerBookingRequestsController } from './partner-booking-requests.controller';
import { PartnerBillboardsController } from './partner-billboards.controller';
import { PublicBillboardsController } from './public-billboards.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    PartnerBillboardsController,
    AdminBillboardsController,
    PublicBillboardsController,
    CustomerBookingRequestsController,
    AdminBookingRequestsController,
    PartnerBookingRequestsController,
  ],
  providers: [BillboardsService, BillboardsRepository],
  exports: [BillboardsService, BillboardsRepository],
})
export class BillboardsModule {}
