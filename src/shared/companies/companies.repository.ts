import { Injectable } from '@nestjs/common';
import {
  Company,
  CompanyServiceSubscription,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
} from '@prisma/client';
import { BaseRepository } from '../database/repositories/base.repository';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class CompaniesRepository extends BaseRepository<Company> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.company);
  }

  findById(id: string) {
    return this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: this.defaultInclude(),
    });
  }

  findActiveByEmail(email: string, excludeId?: string) {
    return this.prisma.company.findFirst({
      where: {
        email,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  createCompany(data: Prisma.CompanyCreateInput) {
    return this.prisma.company.create({
      data,
      include: this.defaultInclude(),
    });
  }

  updateCompany(id: string, data: Prisma.CompanyUpdateInput) {
    return this.prisma.company.update({
      where: { id },
      data,
      include: this.defaultInclude(),
    });
  }

  async syncServiceSubscriptions(
    companyId: string,
    serviceTypes: ServiceType[],
  ): Promise<CompanyServiceSubscription[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.companyServiceSubscription.updateMany({
        where: {
          companyId,
          serviceType: { notIn: serviceTypes },
        },
        data: { status: ServiceSubscriptionStatus.INACTIVE },
      });

      await Promise.all(
        serviceTypes.map((serviceType) =>
          tx.companyServiceSubscription.upsert({
            where: {
              companyId_serviceType: {
                companyId,
                serviceType,
              },
            },
            update: { status: ServiceSubscriptionStatus.ACTIVE },
            create: {
              companyId,
              serviceType,
              status: ServiceSubscriptionStatus.ACTIVE,
            },
          }),
        ),
      );

      return tx.companyServiceSubscription.findMany({
        where: { companyId },
        orderBy: { serviceType: 'asc' },
      });
    });
  }

  defaultInclude() {
    return {
      serviceSubscriptions: {
        orderBy: { serviceType: 'asc' },
      },
    } satisfies Prisma.CompanyInclude;
  }
}
