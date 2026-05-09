import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import '@fastify/multipart';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import {
  BillboardStatus,
  BookingRequestStatus,
  BillboardType,
  MediaType,
  NotificationType,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
  UserRole,
} from '@prisma/client';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { AddBillboardMediaDto } from './dto/add-billboard-media.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CreateBillboardDto } from './dto/create-billboard.dto';
import { CreateUnavailablePeriodDto } from './dto/create-unavailable-period.dto';
import { QueryBookingRequestsDto } from './dto/query-booking-requests.dto';
import { QueryBillboardsDto } from './dto/query-billboards.dto';
import { PublicQueryBillboardsDto } from './dto/public-query-billboards.dto';
import { RejectBillboardDto } from './dto/reject-billboard.dto';
import { UpdateBookingRequestStatusDto } from './dto/update-booking-request-status.dto';
import { UpdateBillboardMediaDto } from './dto/update-billboard-media.dto';
import { UpdateBillboardDto } from './dto/update-billboard.dto';
import { UpdateUnavailablePeriodDto } from './dto/update-unavailable-period.dto';
import { BillboardsRepository } from './billboards.repository';

const MAX_MEDIA_COUNT = 5;
const MAX_GALLERY_IMAGES = 4;
const BILLBOARD_UPLOAD_DIR = 'billboards';
const ALLOWED_IMAGE_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

interface ParsedMediaUpload {
  url: string;
  filePath: string;
  isMain?: boolean;
  sortOrder?: number;
}

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

@Injectable()
export class BillboardsService {
  constructor(
    private readonly billboardsRepository: BillboardsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async createPartnerBillboard(
    user: AuthenticatedUser,
    createBillboardDto: CreateBillboardDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const { submitForApproval, ...billboardData } = createBillboardDto;

    const billboard = await this.billboardsRepository.createBillboard({
      ...billboardData,
      status: submitForApproval
        ? BillboardStatus.PENDING_APPROVAL
        : BillboardStatus.DRAFT,
      company: { connect: { id: companyId } },
    });

    if (submitForApproval) {
      await this.notifyBillboardSubmitted(billboard.id);
    }

    return billboard;
  }

  async findPartnerBillboards(
    user: AuthenticatedUser,
    query: QueryBillboardsDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);

    return this.billboardsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildWhere(query, companyId),
      include: this.billboardsRepository.defaultInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPartnerBillboard(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const billboard = await this.billboardsRepository.findCompanyBillboard(
      id,
      companyId,
    );

    if (!billboard) {
      throw new NotFoundException('Billboard not found');
    }

    return billboard;
  }

  async updatePartnerBillboard(
    user: AuthenticatedUser,
    id: string,
    updateBillboardDto: UpdateBillboardDto,
  ) {
    const billboard = await this.findPartnerBillboard(user, id);

    const updatedBillboard = await this.billboardsRepository.updateBillboard(
      id,
      {
        ...updateBillboardDto,
        ...(billboard.status === BillboardStatus.APPROVED
          ? {
              status: BillboardStatus.PENDING_APPROVAL,
              approvedAt: null,
            }
          : {}),
      },
    );

    if (billboard.status === BillboardStatus.APPROVED) {
      await this.notifyBillboardSubmitted(id);
    }

    return updatedBillboard;
  }

  async deletePartnerBillboard(user: AuthenticatedUser, id: string) {
    await this.findPartnerBillboard(user, id);

    return this.billboardsRepository.updateBillboard(id, {
      deletedAt: new Date(),
    });
  }

  async submitPartnerBillboard(user: AuthenticatedUser, id: string) {
    const billboard = await this.findPartnerBillboard(user, id);

    if (
      billboard.status !== BillboardStatus.DRAFT &&
      billboard.status !== BillboardStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only draft or rejected billboards can be submitted',
      );
    }

    const updatedBillboard = await this.billboardsRepository.updateBillboard(
      id,
      {
        status: BillboardStatus.PENDING_APPROVAL,
        rejectionReason: null,
      },
    );

    await this.notifyBillboardSubmitted(id);

    return updatedBillboard;
  }

  findAdminBillboards(query: QueryBillboardsDto) {
    return this.billboardsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildWhere(query),
      include: this.billboardsRepository.defaultInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminBillboard(id: string) {
    const billboard = await this.billboardsRepository.findById(id);

    if (!billboard) {
      throw new NotFoundException('Billboard not found');
    }

    return billboard;
  }

  async approveBillboard(id: string) {
    await this.findAdminBillboard(id);

    return this.billboardsRepository.updateBillboard(id, {
      status: BillboardStatus.APPROVED,
      approvedAt: new Date(),
      rejectionReason: null,
    });
  }

  async rejectBillboard(id: string, rejectBillboardDto: RejectBillboardDto) {
    await this.findAdminBillboard(id);

    return this.billboardsRepository.updateBillboard(id, {
      status: BillboardStatus.REJECTED,
      rejectionReason: rejectBillboardDto.reason,
      approvedAt: null,
    });
  }

  async archiveBillboard(id: string) {
    await this.findAdminBillboard(id);

    return this.billboardsRepository.updateBillboard(id, {
      status: BillboardStatus.ARCHIVED,
    });
  }

  async addPartnerMedia(
    user: AuthenticatedUser,
    billboardId: string,
    addMediaDto: AddBillboardMediaDto,
  ) {
    const billboard = await this.findPartnerBillboard(user, billboardId);
    const type = addMediaDto.type ?? MediaType.IMAGE;

    this.ensureImageMediaType(type);

    return this.createBillboardMediaRecord(
      billboardId,
      billboard.media ?? [],
      addMediaDto.url,
      addMediaDto.isMain,
      addMediaDto.sortOrder,
    );
  }

  async uploadPartnerMedia(
    user: AuthenticatedUser,
    billboardId: string,
    request: FastifyRequest,
  ) {
    const billboard = await this.findPartnerBillboard(user, billboardId);
    const upload = await this.parseAndStoreMediaUpload(request, billboardId);

    try {
      return await this.createBillboardMediaRecord(
        billboardId,
        billboard.media ?? [],
        upload.url,
        upload.isMain,
        upload.sortOrder,
      );
    } catch (error) {
      await this.deleteStoredFile(upload.filePath);
      throw error;
    }
  }

  async uploadAdminMedia(billboardId: string, request: FastifyRequest) {
    const billboard = await this.findAdminBillboard(billboardId);
    const upload = await this.parseAndStoreMediaUpload(request, billboardId);

    try {
      return await this.createBillboardMediaRecord(
        billboardId,
        billboard.media ?? [],
        upload.url,
        upload.isMain,
        upload.sortOrder,
      );
    } catch (error) {
      await this.deleteStoredFile(upload.filePath);
      throw error;
    }
  }

  async listPartnerMedia(user: AuthenticatedUser, billboardId: string) {
    await this.findPartnerBillboard(user, billboardId);

    return this.billboardsRepository.listMedia(billboardId);
  }

  async updatePartnerMedia(
    user: AuthenticatedUser,
    billboardId: string,
    mediaId: string,
    updateMediaDto: UpdateBillboardMediaDto,
  ) {
    await this.findPartnerBillboard(user, billboardId);
    await this.findBillboardMediaOrThrow(billboardId, mediaId);

    return this.billboardsRepository.updateMedia(
      mediaId,
      billboardId,
      {
        url: updateMediaDto.url,
        isMain: updateMediaDto.isMain,
        sortOrder: updateMediaDto.sortOrder,
      },
      updateMediaDto.isMain === true,
    );
  }

  async deletePartnerMedia(
    user: AuthenticatedUser,
    billboardId: string,
    mediaId: string,
  ) {
    await this.findPartnerBillboard(user, billboardId);
    await this.findBillboardMediaOrThrow(billboardId, mediaId);
    await this.billboardsRepository.deleteMedia(mediaId, billboardId);

    return { message: 'Billboard media deleted successfully' };
  }

  async listAdminMedia(billboardId: string) {
    await this.findAdminBillboard(billboardId);

    return this.billboardsRepository.listMedia(billboardId);
  }

  async createPartnerUnavailablePeriod(
    user: AuthenticatedUser,
    billboardId: string,
    createPeriodDto: CreateUnavailablePeriodDto,
  ) {
    await this.findPartnerBillboard(user, billboardId);
    this.ensureValidDateRange(
      createPeriodDto.startDate,
      createPeriodDto.endDate,
    );
    await this.ensureNoUnavailablePeriodOverlap(
      billboardId,
      createPeriodDto.startDate,
      createPeriodDto.endDate,
    );

    return this.billboardsRepository.createUnavailablePeriod({
      billboardId,
      startDate: createPeriodDto.startDate,
      endDate: createPeriodDto.endDate,
      reason: createPeriodDto.reason,
    });
  }

  async listPartnerUnavailablePeriods(
    user: AuthenticatedUser,
    billboardId: string,
  ) {
    await this.findPartnerBillboard(user, billboardId);

    return this.billboardsRepository.listUnavailablePeriods(billboardId);
  }

  async updatePartnerUnavailablePeriod(
    user: AuthenticatedUser,
    billboardId: string,
    periodId: string,
    updatePeriodDto: UpdateUnavailablePeriodDto,
  ) {
    await this.findPartnerBillboard(user, billboardId);
    const period = await this.findUnavailablePeriodOrThrow(
      billboardId,
      periodId,
    );
    const startDate = updatePeriodDto.startDate ?? period.startDate;
    const endDate = updatePeriodDto.endDate ?? period.endDate;

    this.ensureValidDateRange(startDate, endDate);
    await this.ensureNoUnavailablePeriodOverlap(
      billboardId,
      startDate,
      endDate,
      periodId,
    );

    return this.billboardsRepository.updateUnavailablePeriod(periodId, {
      startDate: updatePeriodDto.startDate,
      endDate: updatePeriodDto.endDate,
      reason: updatePeriodDto.reason,
    });
  }

  async deletePartnerUnavailablePeriod(
    user: AuthenticatedUser,
    billboardId: string,
    periodId: string,
  ) {
    await this.findPartnerBillboard(user, billboardId);
    await this.findUnavailablePeriodOrThrow(billboardId, periodId);
    await this.billboardsRepository.deleteUnavailablePeriod(periodId);

    return { message: 'Unavailable period deleted successfully' };
  }

  async listAdminUnavailablePeriods(billboardId: string) {
    await this.findAdminBillboard(billboardId);

    return this.billboardsRepository.listUnavailablePeriods(billboardId);
  }

  async findPublicBillboards(query: PublicQueryBillboardsDto) {
    const result = await this.billboardsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildPublicWhere(query),
      select: this.billboardsRepository.publicSelect(),
      orderBy: { approvedAt: 'desc' },
    });

    return {
      data: result.data.map((billboard) => this.toPublicBillboard(billboard)),
      meta: result.meta,
    };
  }

  async findPublicBillboard(id: string) {
    const billboard = await this.billboardsRepository.findPublicById(
      id,
      this.buildPublicWhere(),
    );

    if (!billboard) {
      throw new NotFoundException('Billboard not found');
    }

    return this.toPublicBillboard(billboard);
  }

  async findSimilarPublicBillboards(id: string, limit = 6) {
    const currentBillboard = await this.billboardsRepository.findPublicById(
      id,
      this.buildPublicWhere(),
    );

    if (!currentBillboard) {
      throw new NotFoundException('Billboard not found');
    }

    const safeLimit = Math.min(Math.max(limit, 1), 12);
    const baseWhere = {
      ...this.buildPublicWhere(),
      id: { not: id },
    } satisfies Prisma.BillboardWhereInput;
    const [sameCity, sameProvince, sameType] = await Promise.all([
      this.billboardsRepository.findPublicMany(
        { ...baseWhere, city: currentBillboard.city },
        safeLimit,
        [{ approvedAt: 'desc' }],
      ),
      this.billboardsRepository.findPublicMany(
        { ...baseWhere, province: currentBillboard.province },
        safeLimit,
        [{ approvedAt: 'desc' }],
      ),
      this.billboardsRepository.findPublicMany(
        { ...baseWhere, type: currentBillboard.type },
        safeLimit,
        [{ approvedAt: 'desc' }],
      ),
    ]);

    const seenIds = new Set<string>();

    return [...sameCity, ...sameProvince, ...sameType]
      .filter((billboard) => {
        if (seenIds.has(billboard.id)) {
          return false;
        }

        seenIds.add(billboard.id);
        return true;
      })
      .slice(0, safeLimit)
      .map((billboard) => this.toPublicBillboard(billboard));
  }

  async checkPublicAvailability(
    billboardId: string,
    checkAvailabilityDto: CheckAvailabilityDto,
  ) {
    await this.findPublicBillboard(billboardId);

    return this.checkBillboardAvailability(
      billboardId,
      checkAvailabilityDto.startDate,
      checkAvailabilityDto.endDate,
    );
  }

  async checkBillboardAvailability(
    billboardId: string,
    startDate: Date,
    endDate: Date,
    excludeBookingRequestId?: string,
  ) {
    this.ensureValidDateRange(startDate, endDate);

    const [unavailablePeriods, approvedBookings] = await Promise.all([
      this.billboardsRepository.findOverlappingUnavailablePeriods(
        billboardId,
        startDate,
        endDate,
      ),
      this.billboardsRepository.findOverlappingApprovedBookings(
        billboardId,
        startDate,
        endDate,
        excludeBookingRequestId,
      ),
    ]);
    const conflicts = [
      ...unavailablePeriods.map((period) => ({
        type: 'UNAVAILABLE_PERIOD' as const,
        startDate: period.startDate,
        endDate: period.endDate,
      })),
      ...approvedBookings.map((booking) => ({
        type: 'APPROVED_BOOKING' as const,
        startDate: booking.startDate,
        endDate: booking.endDate,
      })),
    ];

    return {
      billboardId,
      startDate,
      endDate,
      available: conflicts.length === 0,
      conflicts,
    };
  }

  async createCustomerBookingRequest(
    user: AuthenticatedUser,
    billboardId: string,
    createBookingDto: CreateBookingRequestDto,
  ) {
    this.ensureCustomer(user);
    const billboard = await this.billboardsRepository.findPublicById(
      billboardId,
      this.buildPublicWhere(),
    );

    if (!billboard) {
      throw new NotFoundException('Billboard not found');
    }

    const availability = await this.checkBillboardAvailability(
      billboardId,
      createBookingDto.startDate,
      createBookingDto.endDate,
    );

    if (!availability.available) {
      throw new BadRequestException({
        message: 'Billboard is not available for the selected date range',
        conflicts: availability.conflicts,
      });
    }

    const bookingRequest = await this.billboardsRepository.createBookingRequest(
      {
        billboardId,
        customerId: user.id,
        startDate: createBookingDto.startDate,
        endDate: createBookingDto.endDate,
        customerFullName: user.fullName,
        customerEmail: user.email,
        customerPhone: user.phone ?? '',
        customerCompany: createBookingDto.customerCompany,
        customerNotes: createBookingDto.customerNotes,
        estimatedPrice: billboard.price as Prisma.Decimal | null,
        pricingUnit: billboard.pricingUnit,
        currency: billboard.currency,
        status: BookingRequestStatus.PENDING,
      },
    );

    await this.notificationsService.create({
      role: UserRole.SUPER_ADMIN,
      type: NotificationType.BOOKING_REQUEST_CREATED,
      title: 'New booking request',
      message: 'A customer created a new booking request.',
      entityType: 'BOOKING_REQUEST',
      entityId: bookingRequest.id,
    });

    return this.withBookingBillboardMainImage(bookingRequest);
  }

  async findCustomerBookingRequests(
    user: AuthenticatedUser,
    query: QueryBookingRequestsDto,
  ) {
    this.ensureCustomer(user);
    const result = await this.paginateBookingRequests({
      page: query.page,
      limit: query.limit,
      where: {
        deletedAt: null,
        customerId: user.id,
        ...(query.status ? { status: query.status } : {}),
      },
      include: this.billboardsRepository.customerBookingInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: result.data.map((booking) =>
        this.withBookingBillboardMainImage(booking),
      ),
      meta: result.meta,
    };
  }

  async findCustomerBookingRequest(user: AuthenticatedUser, id: string) {
    this.ensureCustomer(user);
    const bookingRequest =
      await this.billboardsRepository.findCustomerBookingRequest(id, user.id);

    if (!bookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    return this.withBookingBillboardMainImage(bookingRequest);
  }

  async cancelCustomerBookingRequest(user: AuthenticatedUser, id: string) {
    this.ensureCustomer(user);
    const bookingRequest =
      await this.billboardsRepository.findCustomerBookingRequest(id, user.id);

    if (!bookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    if (
      bookingRequest.status !== BookingRequestStatus.PENDING &&
      bookingRequest.status !== BookingRequestStatus.CONTACTED
    ) {
      throw new BadRequestException(
        'Only pending or contacted booking requests can be cancelled',
      );
    }

    const updatedBookingRequest =
      await this.billboardsRepository.updateBookingRequest(id, {
        status: BookingRequestStatus.CANCELLED,
      });

    return this.withBookingBillboardMainImage(updatedBookingRequest);
  }

  async findAdminBookingRequests(query: QueryBookingRequestsDto) {
    const result = await this.paginateBookingRequests({
      page: query.page,
      limit: query.limit,
      where: this.buildBookingWhere(query),
      include: this.billboardsRepository.adminBookingInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: result.data.map((booking) =>
        this.withBookingBillboardMainImage(booking),
      ),
      meta: result.meta,
    };
  }

  async findAdminBookingRequest(id: string) {
    const bookingRequest =
      await this.billboardsRepository.findBookingRequestById(id);

    if (!bookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    return this.withBookingBillboardMainImage(bookingRequest);
  }

  async updateAdminBookingRequestStatus(
    id: string,
    updateStatusDto: UpdateBookingRequestStatusDto,
  ) {
    const bookingRequest =
      await this.billboardsRepository.findBookingRequestById(id);

    if (!bookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    if (updateStatusDto.status === BookingRequestStatus.APPROVED) {
      const availability = await this.checkBillboardAvailability(
        bookingRequest.billboardId,
        bookingRequest.startDate,
        bookingRequest.endDate,
        id,
      );

      if (!availability.available) {
        throw new BadRequestException({
          message: 'Billboard is not available for the selected date range',
          conflicts: availability.conflicts,
        });
      }
    }

    const updatedBookingRequest =
      await this.billboardsRepository.updateBookingRequest(id, {
        status: updateStatusDto.status,
        ...(updateStatusDto.adminNotes !== undefined
          ? { adminNotes: updateStatusDto.adminNotes }
          : {}),
      });

    await this.notificationsService.create({
      userId: bookingRequest.customerId,
      type: NotificationType.BOOKING_REQUEST_STATUS_CHANGED,
      title: 'Booking request status updated',
      message: `Your booking request status changed to ${updateStatusDto.status}.`,
      entityType: 'BOOKING_REQUEST',
      entityId: id,
    });

    return this.withBookingBillboardMainImage(updatedBookingRequest);
  }

  async findPartnerBookingRequests(
    user: AuthenticatedUser,
    query: QueryBookingRequestsDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);
    const result = await this.paginateBookingRequests({
      page: query.page,
      limit: query.limit,
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.billboardId ? { billboardId: query.billboardId } : {}),
        billboard: {
          companyId,
          deletedAt: null,
        },
      },
      select: this.billboardsRepository.partnerBookingSelect(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: result.data.map((booking) =>
        this.withBookingBillboardMainImage(booking),
      ),
      meta: result.meta,
    };
  }

  private async getPartnerCompanyIdWithSubscription(
    user: AuthenticatedUser,
  ): Promise<string> {
    const companyId = this.getPartnerCompanyId(user);
    const subscription =
      await this.billboardsRepository.findActiveBillboardsSubscription(
        companyId,
      );

    if (!subscription) {
      throw new ForbiddenException(
        'Company is not subscribed to billboards service',
      );
    }

    return companyId;
  }

  private getPartnerCompanyId(user: AuthenticatedUser): string {
    if (!user.companyId) {
      throw new ForbiddenException(
        'Authenticated user is not linked to a company',
      );
    }

    return user.companyId;
  }

  private buildWhere(
    query: QueryBillboardsDto,
    companyId?: string,
  ): Prisma.BillboardWhereInput {
    return {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(!companyId && query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { country: { contains: query.search, mode: 'insensitive' } },
              { province: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildPublicWhere(
    query: PublicQueryBillboardsDto = new PublicQueryBillboardsDto(),
  ): Prisma.BillboardWhereInput {
    return {
      status: BillboardStatus.APPROVED,
      deletedAt: null,
      company: {
        status: 'ACTIVE',
        deletedAt: null,
        serviceSubscriptions: {
          some: {
            serviceType: ServiceType.BILLBOARDS,
            status: ServiceSubscriptionStatus.ACTIVE,
          },
        },
      },
      ...(query.country ? { country: query.country } : {}),
      ...(query.province ? { province: query.province } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.hasLighting !== undefined
        ? { hasLighting: query.hasLighting }
        : {}),
      ...(query.pricingUnit ? { pricingUnit: query.pricingUnit } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.minWidth !== undefined || query.maxWidth !== undefined
        ? {
            width: {
              ...(query.minWidth !== undefined ? { gte: query.minWidth } : {}),
              ...(query.maxWidth !== undefined ? { lte: query.maxWidth } : {}),
            },
          }
        : {}),
      ...(query.minHeight !== undefined || query.maxHeight !== undefined
        ? {
            height: {
              ...(query.minHeight !== undefined
                ? { gte: query.minHeight }
                : {}),
              ...(query.maxHeight !== undefined
                ? { lte: query.maxHeight }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { country: { contains: query.search, mode: 'insensitive' } },
              { province: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
              { addressText: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildBookingWhere(
    query: QueryBookingRequestsDto,
  ): Prisma.BookingRequestWhereInput {
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.billboardId ? { billboardId: query.billboardId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.companyId
        ? {
            billboard: {
              companyId: query.companyId,
            },
          }
        : {}),
    };
  }

  private async paginateBookingRequests(args: {
    page: number;
    limit: number;
    where: Prisma.BookingRequestWhereInput;
    include?: Prisma.BookingRequestInclude;
    select?: Prisma.BookingRequestSelect;
    orderBy?: Prisma.BookingRequestOrderByWithRelationInput;
  }) {
    const skip = (args.page - 1) * args.limit;
    const [data, total] = await Promise.all([
      this.billboardsRepository.findBookingRequests({
        where: args.where,
        include: args.include,
        select: args.select,
        orderBy: args.orderBy,
        skip,
        take: args.limit,
      }),
      this.billboardsRepository.countBookingRequests(args.where),
    ]);
    const totalPages = Math.ceil(total / args.limit);

    return {
      data,
      meta: {
        page: args.page,
        limit: args.limit,
        total,
        totalPages,
        hasNextPage: args.page < totalPages,
        hasPreviousPage: args.page > 1,
      },
    };
  }

  private toPublicBillboard(billboard: {
    media?: { isMain: boolean }[];
    type?: BillboardType;
    [key: string]: unknown;
  }) {
    const media = billboard.media ?? [];

    return {
      ...billboard,
      media,
      mainImage: media.find((item) => item.isMain) ?? media[0] ?? null,
    };
  }

  private withBookingBillboardMainImage(bookingRequest: {
    billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown };
    [key: string]: unknown;
  }) {
    if (!bookingRequest.billboard) {
      return bookingRequest;
    }

    return {
      ...bookingRequest,
      billboard: this.toPublicBillboard(bookingRequest.billboard),
    };
  }

  private ensureCustomer(user: AuthenticatedUser): void {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException(
        'Only customers can manage booking requests',
      );
    }
  }

  private async findBillboardMediaOrThrow(
    billboardId: string,
    mediaId: string,
  ) {
    const media = await this.billboardsRepository.findMediaById(
      mediaId,
      billboardId,
    );

    if (!media) {
      throw new NotFoundException('Billboard media not found');
    }

    return media;
  }

  private async findUnavailablePeriodOrThrow(
    billboardId: string,
    periodId: string,
  ) {
    const period = await this.billboardsRepository.findUnavailablePeriodById(
      periodId,
      billboardId,
    );

    if (!period) {
      throw new NotFoundException('Unavailable period not found');
    }

    return period;
  }

  private ensureValidDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }

  private async ensureNoUnavailablePeriodOverlap(
    billboardId: string,
    startDate: Date,
    endDate: Date,
    excludePeriodId?: string,
  ): Promise<void> {
    const overlappingPeriods =
      await this.billboardsRepository.findOverlappingUnavailablePeriods(
        billboardId,
        startDate,
        endDate,
        excludePeriodId,
      );

    if (overlappingPeriods.length > 0) {
      throw new BadRequestException(
        'Unavailable period overlaps existing period',
      );
    }
  }

  private ensureImageMediaType(type: MediaType): void {
    if (type !== MediaType.IMAGE) {
      throw new BadRequestException('Only image media is supported for now');
    }
  }

  private async createBillboardMediaRecord(
    billboardId: string,
    media: { isMain: boolean }[],
    url: string,
    requestedIsMain?: boolean,
    sortOrder?: number,
  ) {
    const isFirstMedia = media.length === 0;
    const isMain = isFirstMedia || requestedIsMain === true;
    const nonMainCount = media.filter((item) => !item.isMain).length;

    if (media.length >= MAX_MEDIA_COUNT) {
      throw new BadRequestException('A billboard can have up to 5 media items');
    }

    if (!isMain && nonMainCount >= MAX_GALLERY_IMAGES) {
      throw new BadRequestException(
        'A billboard can have up to 4 gallery images',
      );
    }

    return this.billboardsRepository.addMedia(
      billboardId,
      {
        billboardId,
        url,
        type: MediaType.IMAGE,
        isMain,
        sortOrder: sortOrder ?? 0,
      },
      isMain,
    );
  }

  private async parseAndStoreMediaUpload(
    request: FastifyRequest,
    billboardId: string,
  ): Promise<ParsedMediaUpload> {
    const multipartRequest = request as MultipartFastifyRequest;

    if (!multipartRequest.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const maxUploadSizeMb =
      this.configService.getOrThrow<number>('maxUploadSizeMb');
    let uploadedFile: ParsedMediaUpload | undefined;
    let isMain: boolean | undefined;
    let sortOrder: number | undefined;

    try {
      for await (const part of multipartRequest.parts({
        limits: {
          fileSize: maxUploadSizeMb * 1024 * 1024,
          files: 1,
          fields: 2,
          parts: 3,
        },
      })) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            throw new BadRequestException('File field must be named file');
          }

          if (uploadedFile) {
            throw new BadRequestException('Only one file can be uploaded');
          }

          uploadedFile = await this.storeMultipartImage(part, billboardId);
          continue;
        }

        if (part.fieldname === 'isMain') {
          isMain = this.parseMultipartBoolean(part.value);
        }

        if (part.fieldname === 'sortOrder') {
          sortOrder = this.parseMultipartSortOrder(part.value);
        }
      }
    } catch (error) {
      if (uploadedFile) {
        await this.deleteStoredFile(uploadedFile.filePath);
      }

      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (!uploadedFile) {
      throw new BadRequestException('Image file is required');
    }

    return {
      ...uploadedFile,
      isMain,
      sortOrder,
    };
  }

  private async storeMultipartImage(
    file: MultipartFile,
    billboardId: string,
  ): Promise<ParsedMediaUpload> {
    const extension = ALLOWED_IMAGE_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are supported',
      );
    }

    const uploadRoot = this.configService.getOrThrow<string>('uploadRoot');
    const publicBaseUrl =
      this.configService.getOrThrow<string>('publicBaseUrl');
    const uploadDir = resolve(process.cwd(), uploadRoot, BILLBOARD_UPLOAD_DIR);
    const filename = `${billboardId}-${Date.now()}-${randomUUID()}${extension}`;
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
      url: `${publicBaseUrl.replace(/\/$/, '')}/${uploadRoot}/${BILLBOARD_UPLOAD_DIR}/${filename}`,
    };
  }

  private parseMultipartBoolean(value: unknown): boolean {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    throw new BadRequestException('isMain must be a boolean');
  }

  private parseMultipartSortOrder(value: unknown): number {
    const sortOrder = Number(value);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new BadRequestException('sortOrder must be a non-negative integer');
    }

    return sortOrder;
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

  private notifyBillboardSubmitted(billboardId: string) {
    return this.notificationsService.create({
      role: UserRole.SUPER_ADMIN,
      type: NotificationType.BILLBOARD_SUBMITTED,
      title: 'Billboard submitted for approval',
      message: 'A billboard was submitted for approval.',
      entityType: 'BILLBOARD',
      entityId: billboardId,
    });
  }
}
