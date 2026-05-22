import { Injectable } from '@nestjs/common';
import {
  Company,
  CompanyServiceSubscription,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { BaseRepository } from '../database/repositories/base.repository';
import { PrismaService } from '../database/prisma/prisma.service';

interface CreateCompanyWithAdminInput {
  company: {
    name: string;
    email?: string;
    phone?: string;
    serviceTypes?: ServiceType[];
  };
  admin: {
    fullName: string;
    email: string;
    phone?: string;
    passwordHash: string;
  };
}

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

  createCompanyWithAdmin(input: CreateCompanyWithAdminInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.company.email) {
        const existingCompany = await tx.company.findFirst({
          where: {
            email: input.company.email,
            deletedAt: null,
          },
        });

        if (existingCompany) {
          throw new ConflictException('Company email already exists');
        }
      }

      const existingUser = await tx.user.findFirst({
        where: {
          email: input.admin.email,
          deletedAt: null,
        },
      });

      if (existingUser) {
        throw new ConflictException('User email already exists');
      }

      const company = await tx.company.create({
        data: {
          name: input.company.name,
          email: input.company.email,
          phone: input.company.phone,
          serviceSubscriptions: input.company.serviceTypes?.length
            ? {
                create: input.company.serviceTypes.map((serviceType) => ({
                  serviceType,
                  status: ServiceSubscriptionStatus.ACTIVE,
                })),
              }
            : undefined,
        },
        select: this.companyWithServicesSelect(),
      });

      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          fullName: input.admin.fullName,
          email: input.admin.email,
          phone: input.admin.phone,
          passwordHash: input.admin.passwordHash,
          role: UserRole.COMPANY_ADMIN,
          status: UserStatus.ACTIVE,
        },
        select: this.adminSelect(),
      });

      return { company, admin };
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

  private companyWithServicesSelect() {
    return {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      serviceSubscriptions: {
        orderBy: { serviceType: 'asc' },
      },
    } satisfies Prisma.CompanySelect;
  }

  private adminSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      status: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    } satisfies Prisma.UserSelect;
  }
}
