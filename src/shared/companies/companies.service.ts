import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyStatus,
  Prisma,
  ServiceSubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../auth/constants/auth.constants';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithAdminDto } from './dto/create-company-with-admin.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyServicesDto } from './dto/update-company-services.dto';
import { CompaniesRepository } from './companies.repository';

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async create(createCompanyDto: CreateCompanyDto) {
    const email = this.normalizeEmail(createCompanyDto.email);

    if (email) {
      await this.ensureEmailIsAvailable(email);
    }

    return this.companiesRepository.createCompany({
      name: createCompanyDto.name,
      email,
      phone: createCompanyDto.phone,
      serviceSubscriptions: createCompanyDto.serviceTypes?.length
        ? {
            create: createCompanyDto.serviceTypes.map((serviceType) => ({
              serviceType,
              status: ServiceSubscriptionStatus.ACTIVE,
            })),
          }
        : undefined,
    });
  }

  async createWithAdmin(createCompanyWithAdminDto: CreateCompanyWithAdminDto) {
    const companyEmail = this.normalizeEmail(createCompanyWithAdminDto.email);
    const adminEmail = this.normalizeRequiredEmail(
      createCompanyWithAdminDto.admin.email,
    );
    const passwordHash = await bcrypt.hash(
      createCompanyWithAdminDto.admin.password,
      BCRYPT_SALT_ROUNDS,
    );

    return this.companiesRepository.createCompanyWithAdmin({
      company: {
        name: createCompanyWithAdminDto.name,
        email: companyEmail,
        phone: createCompanyWithAdminDto.phone,
        serviceTypes: createCompanyWithAdminDto.serviceTypes,
      },
      admin: {
        fullName: createCompanyWithAdminDto.admin.fullName,
        email: adminEmail,
        phone: createCompanyWithAdminDto.admin.phone,
        passwordHash,
      },
    });
  }

  findAll(query: QueryCompaniesDto) {
    const where = this.buildWhere(query);

    return this.companiesRepository.paginate({
      page: query.page,
      limit: query.limit,
      where,
      include: this.companiesRepository.defaultInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.companiesRepository.findById(id);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.findOne(id);

    const email = this.normalizeEmail(updateCompanyDto.email);

    if (email) {
      await this.ensureEmailIsAvailable(email, id);
    }

    return this.companiesRepository.updateCompany(id, {
      ...updateCompanyDto,
      ...(updateCompanyDto.email !== undefined ? { email } : {}),
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.companiesRepository.updateCompany(id, {
      deletedAt: new Date(),
      status: CompanyStatus.INACTIVE,
    });
  }

  async updateServices(
    id: string,
    updateCompanyServicesDto: UpdateCompanyServicesDto,
  ) {
    await this.findOne(id);

    return this.companiesRepository.syncServiceSubscriptions(
      id,
      updateCompanyServicesDto.serviceTypes,
    );
  }

  private async ensureEmailIsAvailable(
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const existingCompany = await this.companiesRepository.findActiveByEmail(
      email,
      excludeId,
    );

    if (existingCompany) {
      throw new ConflictException('Company email already exists');
    }
  }

  private buildWhere(query: QueryCompaniesDto): Prisma.CompanyWhereInput {
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.serviceType
        ? {
            serviceSubscriptions: {
              some: {
                serviceType: query.serviceType,
                status: ServiceSubscriptionStatus.ACTIVE,
              },
            },
          }
        : {}),
    };
  }

  private normalizeEmail(email?: string): string | undefined {
    return email?.trim().toLowerCase();
  }

  private normalizeRequiredEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
