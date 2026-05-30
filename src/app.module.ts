import { Module } from '@nestjs/common';
import { BillboardsModule } from './services/billboards/billboards.module';
import { ExhibitionsModule } from './services/exhibitions/exhibitions.module';
import { AuthModule } from './shared/auth/auth.module';
import { CompaniesModule } from './shared/companies/companies.module';
import { AppConfigModule } from './shared/config/config.module';
import { PrismaModule } from './shared/database/prisma/prisma.module';
import { HealthModule } from './shared/health/health.module';
import { NotificationsModule } from './shared/notifications/notifications.module';
import { UsersModule } from './shared/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    BillboardsModule,
    ExhibitionsModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
