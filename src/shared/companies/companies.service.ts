import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import '@fastify/multipart';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import {
  CompanyStatus,
  Prisma,
  ServiceSubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { BCRYPT_SALT_ROUNDS } from '../auth/constants/auth.constants';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithAdminDto } from './dto/create-company-with-admin.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyLogoDto } from './dto/update-company-logo.dto';
import { UpdateCompanyServicesDto } from './dto/update-company-services.dto';
import { CompaniesRepository } from './companies.repository';

const COMPANY_LOGO_UPLOAD_DIR = join('companies', 'logos');
const ALLOWED_LOGO_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

interface MultipartValue {
  type: 'field';
  value: unknown;
  fieldname: string;
}

interface MultipartFastifyRequest extends FastifyRequest {
  isMultipart: () => boolean;
  parts: (options?: {
    limits?: {
      fileSize?: number;
      files?: number;
      fields?: number;
      parts?: number;
    };
  }) => AsyncIterableIterator<MultipartFile | MultipartValue>;
}

interface StoredUpload {
  url: string;
  filePath: string;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly configService: ConfigService,
  ) {}

  async create(createCompanyDto: CreateCompanyDto) {
    const email = this.normalizeEmail(createCompanyDto.email);

    if (email) {
      await this.ensureEmailIsAvailable(email);
    }

    return this.companiesRepository.createCompany({
      name: createCompanyDto.name,
      email,
      phone: createCompanyDto.phone,
      logoUrl: createCompanyDto.logoUrl,
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
        logoUrl: createCompanyWithAdminDto.logoUrl,
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

  async uploadLogo(id: string, request: FastifyRequest) {
    await this.findOne(id);
    const upload = await this.parseLogoUpload(request, id);

    try {
      return await this.companiesRepository.updateCompany(id, {
        logoUrl: upload.url,
      });
    } catch (error) {
      await this.deleteStoredFile(upload.filePath);
      throw error;
    }
  }

  async updateLogo(id: string, updateLogoDto: UpdateCompanyLogoDto) {
    await this.findOne(id);

    return this.companiesRepository.updateCompany(id, {
      logoUrl: updateLogoDto.logoUrl,
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

  private async parseLogoUpload(
    request: FastifyRequest,
    companyId: string,
  ): Promise<StoredUpload> {
    const multipartRequest = request as MultipartFastifyRequest;

    if (!multipartRequest.isMultipart()) {
      throw new BadRequestException('multipart/form-data request is required');
    }

    const maxUploadSizeMb =
      this.configService.getOrThrow<number>('maxUploadSizeMb');
    let upload: StoredUpload | undefined;

    try {
      for await (const part of multipartRequest.parts({
        limits: {
          fileSize: maxUploadSizeMb * 1024 * 1024,
          files: 1,
          fields: 0,
          parts: 1,
        },
      })) {
        if (part.type !== 'file' || part.fieldname !== 'logo') {
          throw new BadRequestException('File field must be named logo');
        }

        upload = await this.storeLogoFile(part, companyId);
      }
    } catch (error) {
      if (upload) {
        await this.deleteStoredFile(upload.filePath);
      }

      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (!upload) {
      throw new BadRequestException('logo file is required');
    }

    return upload;
  }

  private async storeLogoFile(
    file: MultipartFile,
    companyId: string,
  ): Promise<StoredUpload> {
    const extension = ALLOWED_LOGO_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException('logo must be a JPEG, PNG, or WebP image');
    }

    const uploadRoot = this.configService.getOrThrow<string>('uploadRoot');
    const publicBaseUrl =
      this.configService.getOrThrow<string>('publicBaseUrl');
    const uploadDir = resolve(process.cwd(), uploadRoot, COMPANY_LOGO_UPLOAD_DIR);
    const filename = `${companyId}-${Date.now()}-${randomUUID()}${extension}`;
    const filePath = join(uploadDir, filename);

    await mkdir(uploadDir, { recursive: true });
    await pipeline(file.file, createWriteStream(filePath));

    if (file.file.truncated) {
      await this.deleteStoredFile(filePath);
      throw new BadRequestException(
        `File size must not exceed ${this.configService.getOrThrow<number>(
          'maxUploadSizeMb',
        )}MB`,
      );
    }

    return {
      filePath,
      url: `${publicBaseUrl.replace(/\/$/, '')}/${uploadRoot}/${COMPANY_LOGO_UPLOAD_DIR.replace(/\\/g, '/')}/${filename}`,
    };
  }

  private isMultipartFileTooLargeError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'FST_REQ_FILE_TOO_LARGE'
    );
  }

  private async deleteStoredFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // Best-effort cleanup for partially handled uploads.
    }
  }
}
