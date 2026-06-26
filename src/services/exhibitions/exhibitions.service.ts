import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import '@fastify/multipart';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CustomerCompanyScope,
  ExhibitionBookingItemStatus,
  ExhibitionBookingRequestStatus,
  ExhibitionBoothStatus,
  ExhibitionMapShape,
  ExhibitionStatus,
  NotificationType,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { CreateBulkExhibitionBoothsDto } from './dto/create-bulk-exhibition-booths.dto';
import { CreateExhibitionBookingDto } from './dto/create-exhibition-booking.dto';
import { CreateExhibitionBoothDto } from './dto/create-exhibition-booth.dto';
import { CreateExhibitionSectorDto } from './dto/create-exhibition-sector.dto';
import { CreateExhibitionDto } from './dto/create-exhibition.dto';
import { DeleteBulkExhibitionBoothsDto } from './dto/delete-bulk-exhibition-booths.dto';
import { QueryExhibitionBookingItemsDto } from './dto/query-exhibition-booking-items.dto';
import { QueryExhibitionBookingsDto } from './dto/query-exhibition-bookings.dto';
import { QueryExhibitionBoothsDto } from './dto/query-exhibition-booths.dto';
import { QueryExhibitionSectorsDto } from './dto/query-exhibition-sectors.dto';
import { QueryExhibitionsDto } from './dto/query-exhibitions.dto';
import { RejectExhibitionBookingItemDto } from './dto/reject-exhibition-booking-item.dto';
import { RejectExhibitionDto } from './dto/reject-exhibition.dto';
import {
  UpdateBulkExhibitionBoothItemDto,
  UpdateBulkExhibitionBoothsDto,
} from './dto/update-bulk-exhibition-booths.dto';
import { UpdateExhibitionBoothDto } from './dto/update-exhibition-booth.dto';
import { UpdateExhibitionMapFilesDto } from './dto/update-exhibition-map-files.dto';
import { UpdateExhibitionSectorDto } from './dto/update-exhibition-sector.dto';
import { UpdateExhibitionDto } from './dto/update-exhibition.dto';
import {
  ExhibitionContentInput,
  ExhibitionsRepository,
} from './exhibitions.repository';

const EXHIBITION_MAP_UPLOAD_DIR = join('exhibitions', 'maps');
const EXHIBITION_HERO_UPLOAD_DIR = join('exhibitions', 'heroes');
const ALLOWED_MAP_IMAGE_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const ALLOWED_HERO_IMAGE_MIME_TYPES = ALLOWED_MAP_IMAGE_MIME_TYPES;
const MAP_PDF_MIME_TYPE = 'application/pdf';
const BUSINESS_PROOF_UPLOAD_DIR = join('business-proofs');
const ALLOWED_BUSINESS_PROOF_MIME_TYPES = new Map([
  ...ALLOWED_MAP_IMAGE_MIME_TYPES,
  [MAP_PDF_MIME_TYPE, '.pdf'],
]);

const PARTNER_EDITABLE_EXHIBITION_STATUSES = new Set<ExhibitionStatus>([
  ExhibitionStatus.DRAFT,
  ExhibitionStatus.MAP_IN_PROGRESS,
  ExhibitionStatus.MAP_CONFIRMED,
  ExhibitionStatus.REJECTED,
  ExhibitionStatus.APPROVED,
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

interface ParsedMapFilesUpload {
  mapImage?: StoredMapFile;
  mapPdf?: StoredMapFile;
}

interface StoredMapFile {
  url: string;
  filePath: string;
}

interface ParsedHeroImagesUpload {
  metadata?: CreateExhibitionDto;
  heroImage?: StoredMapFile;
  secondaryHeroImage?: StoredMapFile;
}

type ExhibitionDataDto = CreateExhibitionDto &
  Pick<
    Prisma.ExhibitionUncheckedCreateInput,
    'heroImageUrl' | 'secondaryHeroImageUrl'
  >;

@Injectable()
export class ExhibitionsService {
  constructor(
    private readonly exhibitionsRepository: ExhibitionsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async createPartnerExhibition(
    user: AuthenticatedUser,
    createExhibitionDto: CreateExhibitionDto,
  ) {
    return this.createPartnerExhibitionInternal(user, createExhibitionDto);
  }

  async createPartnerExhibitionMultipart(
    user: AuthenticatedUser,
    request: FastifyRequest,
  ) {
    const upload = await this.parseAndStoreHeroImagesUpload(request);

    if (!upload.metadata || !upload.heroImage) {
      await this.deleteStoredHeroImages(upload);
      throw new BadRequestException('metadata and heroImage are required');
    }

    try {
      return await this.createPartnerExhibitionInternal(user, {
        ...upload.metadata,
        heroImageUrl: upload.heroImage.url,
        secondaryHeroImageUrl: upload.secondaryHeroImage?.url,
      });
    } catch (error) {
      await this.deleteStoredHeroImages(upload);
      throw error;
    }
  }

  private async createPartnerExhibitionInternal(
    user: AuthenticatedUser,
    createExhibitionDto: CreateExhibitionDto | ExhibitionDataDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const slug = await this.generateUniqueSlug(createExhibitionDto.title);
    const { content, data } = this.toExhibitionData(createExhibitionDto);

    return this.exhibitionsRepository.createExhibition(
      {
        ...data,
        companyId,
        slug,
        title: createExhibitionDto.title,
        status: ExhibitionStatus.DRAFT,
      },
      content,
    );
  }

  async findPartnerExhibitions(
    user: AuthenticatedUser,
    query: QueryExhibitionsDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);

    return this.exhibitionsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildWhere(query, companyId),
      include: this.exhibitionsRepository.listInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPartnerExhibition(user: AuthenticatedUser, id: string) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const exhibition = await this.exhibitionsRepository.findCompanyExhibition(
      id,
      companyId,
    );

    if (!exhibition) {
      throw new NotFoundException('Exhibition not found');
    }

    return exhibition;
  }

  async updatePartnerExhibition(
    user: AuthenticatedUser,
    id: string,
    updateExhibitionDto: UpdateExhibitionDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, id);

    if (!PARTNER_EDITABLE_EXHIBITION_STATUSES.has(exhibition.status)) {
      throw new BadRequestException(
        'Exhibition cannot be edited in its current status',
      );
    }

    const { content, data } = this.toExhibitionData(updateExhibitionDto);
    const shouldResubmit = exhibition.status === ExhibitionStatus.APPROVED;
    const updated = await this.exhibitionsRepository.updateExhibition(
      id,
      {
        ...data,
        ...(shouldResubmit
          ? {
              status: ExhibitionStatus.PENDING_APPROVAL,
              approvedAt: null,
            }
          : {}),
      },
      content,
    );

    if (shouldResubmit) {
      await this.notifyExhibitionSubmitted(id);
    }

    return updated;
  }

  async deletePartnerExhibition(user: AuthenticatedUser, id: string) {
    await this.findPartnerExhibition(user, id);

    return this.exhibitionsRepository.softDeleteExhibition(id, new Date());
  }

  async updatePartnerMapFiles(
    user: AuthenticatedUser,
    id: string,
    updateMapFilesDto: UpdateExhibitionMapFilesDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, id);

    if (
      exhibition.status === ExhibitionStatus.APPROVED ||
      exhibition.status === ExhibitionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Approved or archived exhibitions cannot replace map files',
      );
    }

    return this.exhibitionsRepository.updateExhibition(id, {
      mapImageUrl: updateMapFilesDto.mapImageUrl,
      mapPdfUrl: updateMapFilesDto.mapPdfUrl,
      ...(exhibition.status === ExhibitionStatus.DRAFT
        ? { status: ExhibitionStatus.MAP_IN_PROGRESS }
        : {}),
    });
  }

  async uploadPartnerMapFiles(
    user: AuthenticatedUser,
    id: string,
    request: FastifyRequest,
  ) {
    const exhibition = await this.findPartnerExhibition(user, id);

    if (
      exhibition.status === ExhibitionStatus.APPROVED ||
      exhibition.status === ExhibitionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Approved or archived exhibitions cannot replace map files',
      );
    }

    const upload = await this.parseAndStoreMapFilesUpload(request, id);

    try {
      return await this.exhibitionsRepository.updateExhibition(
        id,
        this.toMapFilesUpdateData(upload, exhibition.status),
      );
    } catch (error) {
      await this.deleteStoredMapFiles(upload);
      throw error;
    }
  }

  async createPartnerSector(
    user: AuthenticatedUser,
    exhibitionId: string,
    createSectorDto: CreateExhibitionSectorDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageSectors(exhibition.status);

    return this.exhibitionsRepository.createSector(
      this.toSectorCreateData(exhibitionId, createSectorDto),
    );
  }

  async findPartnerSectors(
    user: AuthenticatedUser,
    exhibitionId: string,
    query: QueryExhibitionSectorsDto,
  ) {
    await this.findPartnerExhibition(user, exhibitionId);

    return this.paginateSectors(exhibitionId, query);
  }

  async findPartnerSector(
    user: AuthenticatedUser,
    exhibitionId: string,
    sectorId: string,
  ) {
    await this.findPartnerExhibition(user, exhibitionId);

    return this.findSectorOrThrow(exhibitionId, sectorId);
  }

  async updatePartnerSector(
    user: AuthenticatedUser,
    exhibitionId: string,
    sectorId: string,
    updateSectorDto: UpdateExhibitionSectorDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageSectors(exhibition.status);
    const sector = await this.findSectorOrThrow(exhibitionId, sectorId);

    return this.exhibitionsRepository.updateSector(
      sector.id,
      this.toSectorUpdateData(updateSectorDto),
    );
  }

  async deletePartnerSector(
    user: AuthenticatedUser,
    exhibitionId: string,
    sectorId: string,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageSectors(exhibition.status);
    const sector = await this.findSectorOrThrow(exhibitionId, sectorId);
    const bookedBooth = await this.exhibitionsRepository.findBookedBoothInSector(
      sector.id,
    );

    if (bookedBooth) {
      throw new BadRequestException('Sectors with booked booths cannot be deleted');
    }

    const deleted = await this.exhibitionsRepository.softDeleteSectorWithBooths(
      sector.id,
      new Date(),
    );

    if (!deleted) {
      throw new BadRequestException('Sectors with booked booths cannot be deleted');
    }

    return deleted;
  }

  async createPartnerBooth(
    user: AuthenticatedUser,
    exhibitionId: string,
    createBoothDto: CreateExhibitionBoothDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageBooths(exhibition.status);
    this.validateCoordinates(createBoothDto.shape, createBoothDto.coordinates);
    await this.validateBoothSector(exhibitionId, createBoothDto.sectorId);

    try {
      const booth = await this.exhibitionsRepository.createBooth({
        exhibitionId,
        sectorId: createBoothDto.sectorId,
        code: createBoothDto.code,
        title: createBoothDto.title,
        description: createBoothDto.description,
        price: createBoothDto.price ?? createBoothDto.localPrice,
        localPrice: createBoothDto.localPrice,
        internationalPrice: createBoothDto.internationalPrice,
        setupPrice: createBoothDto.setupPrice ?? 0,
        currency: createBoothDto.currency ?? 'USD',
        status: createBoothDto.status ?? ExhibitionBoothStatus.AVAILABLE,
        shape: createBoothDto.shape,
        coordinates: createBoothDto.coordinates as unknown as Prisma.InputJsonValue,
        area: createBoothDto.area,
        sortOrder: createBoothDto.sortOrder ?? 0,
      });

      return this.withBoothEffectiveColor(booth);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Booth code already exists');
      }

      throw error;
    }
  }

  async findPartnerBooths(
    user: AuthenticatedUser,
    exhibitionId: string,
    query: QueryExhibitionBoothsDto,
  ) {
    await this.findPartnerExhibition(user, exhibitionId);

    return this.paginateBooths(exhibitionId, query);
  }

  async createCustomerBooking(
    user: AuthenticatedUser,
    exhibitionId: string,
    createBookingDto: CreateExhibitionBookingDto,
  ) {
    this.ensureCustomer(user);
    const exhibition =
      await this.exhibitionsRepository.findPublicBookableExhibition(
        exhibitionId,
      );

    if (!exhibition) {
      throw new NotFoundException('Exhibition not found');
    }

    const uniqueBoothIds = Array.from(new Set(createBookingDto.boothIds));
    if (uniqueBoothIds.length !== createBookingDto.boothIds.length) {
      throw new BadRequestException('boothIds must be unique');
    }

    const booths = exhibition.booths.filter((booth) =>
      uniqueBoothIds.includes(booth.id),
    );

    if (booths.length !== uniqueBoothIds.length) {
      throw new BadRequestException(
        'All booths must belong to the exhibition',
      );
    }

    const unavailableBooth = booths.find(
      (booth) => booth.status !== ExhibitionBoothStatus.AVAILABLE,
    );

    if (unavailableBooth) {
      throw new BadRequestException('All booths must be available');
    }

    const subtotalBeforeTax = booths.reduce(
      (total, booth) =>
        total +
        this.resolveBoothPrice(booth, createBookingDto.customerCompanyScope),
      0,
    );
    const totalTaxAmount = 0;
    const totalAfterTax = subtotalBeforeTax;

    const booking =
      await this.exhibitionsRepository.createBookingRequestWithItems({
        data: {
          exhibitionId: exhibition.id,
          companyId: exhibition.companyId,
          customerId: user.id,
          customerFullName: user.fullName,
          customerPhone: user.phone ?? '',
          customerEmail: user.email,
          customerCompany: createBookingDto.customerCompany,
          customerNotes: createBookingDto.customerNotes,
          commercialRegistryUrl: createBookingDto.commercialRegistryUrl,
          customerCompanyScope: createBookingDto.customerCompanyScope,
          customerSector: createBookingDto.customerSector,
          subtotalBeforeTax,
          totalTaxAmount,
          totalAfterTax,
          status: ExhibitionBookingRequestStatus.PENDING_REVIEW,
        },
        items: booths.map((booth) => ({
          boothId: booth.id,
          status: ExhibitionBookingItemStatus.PENDING,
          priceSnapshot: this.resolveBoothPrice(
            booth,
            createBookingDto.customerCompanyScope,
          ),
          localPriceSnapshot: booth.localPrice,
          internationalPriceSnapshot: booth.internationalPrice,
          setupPriceSnapshot: booth.setupPrice,
          currency: booth.currency,
        })),
      });

    await this.notifyExhibitionBookingCreated(booking.id, exhibition.companyId);

    return booking;
  }

  findCustomerBookings(
    user: AuthenticatedUser,
    query: QueryExhibitionBookingsDto,
  ) {
    this.ensureCustomer(user);

    return this.paginateBookingRequests({
      page: query.page,
      limit: query.limit,
      where: this.buildBookingWhere(query, user.id),
      include: this.exhibitionsRepository.bookingDetailInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCustomerBooking(user: AuthenticatedUser, id: string) {
    this.ensureCustomer(user);
    const booking = await this.exhibitionsRepository.findCustomerBookingRequest(
      id,
      user.id,
    );

    if (!booking) {
      throw new NotFoundException('Exhibition booking not found');
    }

    return booking;
  }

  async cancelCustomerBooking(user: AuthenticatedUser, id: string) {
    const booking = await this.findCustomerBooking(user, id);
    const hasPendingItems = booking.items.some(
      (item) => item.status === ExhibitionBookingItemStatus.PENDING,
    );

    if (!hasPendingItems) {
      throw new BadRequestException('Booking has no pending items to cancel');
    }

    await this.exhibitionsRepository.cancelPendingBookingItems(id);
    await this.syncExhibitionBookingStatus(id);

    return this.findCustomerBooking(user, id);
  }

  async uploadCustomerExhibitionCommercialRegistry(
    user: AuthenticatedUser,
    bookingId: string,
    request: FastifyRequest,
  ) {
    const booking = await this.findCustomerBooking(user, bookingId);
    const upload = await this.parseSingleBusinessProofUpload(request);

    try {
      return await this.exhibitionsRepository.updateBookingRequest(booking.id, {
        commercialRegistryUrl: upload.url,
      });
    } catch (error) {
      await this.deleteStoredFile(upload.filePath);
      throw error;
    }
  }

  async findPartnerBookingItems(
    user: AuthenticatedUser,
    query: QueryExhibitionBookingItemsDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);

    return this.paginateBookingItems({
      page: query.page,
      limit: query.limit,
      where: this.buildBookingItemWhere(query, companyId),
      select: this.exhibitionsRepository.partnerBookingItemSelect(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPartnerBookingItem(user: AuthenticatedUser, id: string) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const item = await this.exhibitionsRepository.findPartnerBookingItemPublic(
      id,
      companyId,
    );

    if (!item) {
      throw new NotFoundException('Exhibition booking item not found');
    }

    return item;
  }

  async approvePartnerBookingItem(user: AuthenticatedUser, id: string) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const item = await this.exhibitionsRepository.findPartnerBookingItem(
      id,
      companyId,
    );

    if (!item) {
      throw new NotFoundException('Exhibition booking item not found');
    }

    if (item.status !== ExhibitionBookingItemStatus.PENDING) {
      throw new BadRequestException('Only pending booking items can be approved');
    }

    if (item.booth.status !== ExhibitionBoothStatus.AVAILABLE) {
      throw new BadRequestException('Booth is no longer available');
    }

    const approved = await this.exhibitionsRepository.approveBookingItem(
      item.id,
      item.boothId,
      new Date(),
    );

    if (!approved) {
      throw new BadRequestException('Booth is no longer available');
    }

    const parentStatus = await this.syncExhibitionBookingStatus(
      item.bookingRequestId,
    );

    await this.notifyExhibitionBookingItemStatusChanged(
      item.bookingRequest.customerId,
      item.id,
      'Exhibition booking item approved',
      'A partner approved one of your exhibition booking items.',
    );

    if (parentStatus === ExhibitionBookingRequestStatus.APPROVED) {
      await this.notifyExhibitionBookingFullyApproved(
        item.bookingRequest.customerId,
        item.bookingRequestId,
      );
    }

    return approved;
  }

  async rejectPartnerBookingItem(
    user: AuthenticatedUser,
    id: string,
    rejectDto: RejectExhibitionBookingItemDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const item = await this.exhibitionsRepository.findPartnerBookingItem(
      id,
      companyId,
    );

    if (!item) {
      throw new NotFoundException('Exhibition booking item not found');
    }

    if (item.status !== ExhibitionBookingItemStatus.PENDING) {
      throw new BadRequestException('Only pending booking items can be rejected');
    }

    const rejected = await this.exhibitionsRepository.rejectBookingItem(
      item.id,
      rejectDto.partnerNotes,
      new Date(),
    );

    await this.syncExhibitionBookingStatus(item.bookingRequestId);
    await this.notifyExhibitionBookingItemStatusChanged(
      item.bookingRequest.customerId,
      item.id,
      'Exhibition booking item rejected',
      'A partner rejected one of your exhibition booking items.',
    );

    return rejected;
  }

  findAdminBookings(query: QueryExhibitionBookingsDto) {
    return this.paginateBookingRequests({
      page: query.page,
      limit: query.limit,
      where: this.buildBookingWhere(query),
      include: this.exhibitionsRepository.bookingDetailInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminBooking(id: string) {
    const booking = await this.exhibitionsRepository.findBookingRequestById(id);

    if (!booking) {
      throw new NotFoundException('Exhibition booking not found');
    }

    return booking;
  }

  async findPartnerBooth(
    user: AuthenticatedUser,
    exhibitionId: string,
    boothId: string,
  ) {
    await this.findPartnerExhibition(user, exhibitionId);

    const booth = await this.findBoothOrThrow(exhibitionId, boothId);

    return this.withBoothEffectiveColor(booth);
  }

  async updatePartnerBooth(
    user: AuthenticatedUser,
    exhibitionId: string,
    boothId: string,
    updateBoothDto: UpdateExhibitionBoothDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageBooths(exhibition.status);
    const booth = await this.findBoothOrThrow(exhibitionId, boothId);

    if (booth.status === ExhibitionBoothStatus.BOOKED) {
      this.ensureBookedBoothPartnerUpdateIsSafe(updateBoothDto);
    }

    const shape = updateBoothDto.shape ?? booth.shape;
    const coordinates = updateBoothDto.coordinates;
    if (coordinates) {
      this.validateCoordinates(shape, coordinates);
    }
    await this.validateBoothSector(exhibitionId, updateBoothDto.sectorId);

    try {
      const updated = await this.exhibitionsRepository.updateBooth(
        boothId,
        this.toBoothUpdateData(updateBoothDto),
      );

      return this.withBoothEffectiveColor(updated);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Booth code already exists');
      }

      throw error;
    }
  }

  async deletePartnerBooth(
    user: AuthenticatedUser,
    exhibitionId: string,
    boothId: string,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageBooths(exhibition.status);
    const booth = await this.findBoothOrThrow(exhibitionId, boothId);

    if (booth.status === ExhibitionBoothStatus.BOOKED) {
      throw new BadRequestException('Booked booths cannot be deleted');
    }

    await this.exhibitionsRepository.updateBooth(boothId, {
      deletedAt: new Date(),
    });

    return { message: 'Exhibition booth deleted successfully' };
  }

  async createPartnerBoothsBulk(
    user: AuthenticatedUser,
    exhibitionId: string,
    createBulkBoothsDto: CreateBulkExhibitionBoothsDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageBooths(exhibition.status);

    const booths = createBulkBoothsDto.booths;
    this.ensureBulkLimit(booths.length);
    this.ensureUniqueValues(
      booths.map((booth) => booth.code),
      'Duplicate booth codes are not allowed in the request',
    );

    const existingBooths =
      await this.exhibitionsRepository.findActiveBoothsByCodes(
        exhibitionId,
        booths.map((booth) => booth.code),
      );
    if (existingBooths.length > 0) {
      throw new ConflictException('Booth code already exists');
    }

    await this.validateBulkBoothSectors(
      exhibitionId,
      booths.map((booth) => booth.sectorId),
    );
    for (const booth of booths) {
      this.validateCoordinates(booth.shape, booth.coordinates);
    }

    try {
      const created = await this.exhibitionsRepository.createBoothsBulk(
        booths.map((booth) => this.toBoothCreateData(exhibitionId, booth)),
      );

      return created.map((booth) => this.withBoothEffectiveColor(booth));
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Booth code already exists');
      }

      throw error;
    }
  }

  async updatePartnerBoothsBulk(
    user: AuthenticatedUser,
    exhibitionId: string,
    updateBulkBoothsDto: UpdateBulkExhibitionBoothsDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageBooths(exhibition.status);

    const updates = updateBulkBoothsDto.booths;
    this.ensureBulkLimit(updates.length);
    const boothIds = updates.map((booth) => booth.id);
    this.ensureUniqueValues(
      boothIds,
      'Duplicate booth IDs are not allowed in the request',
    );

    const existingBooths =
      await this.exhibitionsRepository.findActiveBoothsByIds(
        exhibitionId,
        boothIds,
      );
    if (existingBooths.length !== boothIds.length) {
      throw new BadRequestException('All booths must belong to the exhibition');
    }

    const existingBoothsById = new Map(
      existingBooths.map((booth) => [booth.id, booth]),
    );

    for (const update of updates) {
      const booth = existingBoothsById.get(update.id);
      if (!booth) {
        throw new BadRequestException(
          'All booths must belong to the exhibition',
        );
      }

      if (booth.status === ExhibitionBoothStatus.BOOKED) {
        this.ensureBookedBoothPartnerUpdateIsSafe(update);
      }

      if (update.coordinates) {
        this.validateCoordinates(update.shape ?? booth.shape, update.coordinates);
      }
    }

    await this.validateBulkBoothSectors(
      exhibitionId,
      updates.map((booth) => booth.sectorId),
    );
    await this.ensureBulkUpdateCodeUniqueness(
      exhibitionId,
      updates,
      existingBoothsById,
    );

    try {
      const updated = await this.exhibitionsRepository.updateBoothsBulk(
        updates.map((update) => ({
          id: update.id,
          data: this.toBoothUpdateData(update),
        })),
      );

      return updated.map((booth) => this.withBoothEffectiveColor(booth));
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Booth code already exists');
      }

      throw error;
    }
  }

  async deletePartnerBoothsBulk(
    user: AuthenticatedUser,
    exhibitionId: string,
    deleteBulkBoothsDto: DeleteBulkExhibitionBoothsDto,
  ) {
    const exhibition = await this.findPartnerExhibition(user, exhibitionId);
    this.ensurePartnerCanManageBooths(exhibition.status);

    const boothIds = deleteBulkBoothsDto.boothIds;
    this.ensureBulkLimit(boothIds.length);
    this.ensureUniqueValues(
      boothIds,
      'Duplicate booth IDs are not allowed in the request',
    );

    const booths = await this.exhibitionsRepository.findActiveBoothsByIds(
      exhibitionId,
      boothIds,
    );
    if (booths.length !== boothIds.length) {
      throw new BadRequestException('All booths must belong to the exhibition');
    }

    if (booths.some((booth) => booth.status === ExhibitionBoothStatus.BOOKED)) {
      throw new BadRequestException('Booked booths cannot be deleted');
    }

    const deletedCount = await this.exhibitionsRepository.softDeleteBoothsBulk(
      boothIds,
      new Date(),
    );

    return {
      message: 'Booths deleted successfully',
      deletedCount,
    };
  }

  async confirmPartnerMap(user: AuthenticatedUser, id: string) {
    const exhibition = await this.findPartnerExhibition(user, id);

    if (
      exhibition.status === ExhibitionStatus.PENDING_APPROVAL ||
      exhibition.status === ExhibitionStatus.APPROVED ||
      exhibition.status === ExhibitionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Map cannot be confirmed in the current exhibition status',
      );
    }

    if (!exhibition.mapImageUrl) {
      throw new BadRequestException('Map image is required before confirming');
    }

    const booths =
      await this.exhibitionsRepository.listActiveBoothsForValidation(id);

    if (booths.length === 0) {
      throw new BadRequestException('At least one booth is required');
    }

    const invalidBooth = booths.find(
      (booth) =>
        !booth.code ||
        !booth.title ||
        booth.price === null ||
        !booth.coordinates,
    );

    if (invalidBooth) {
      throw new BadRequestException('All booths must be complete');
    }

    return this.exhibitionsRepository.updateExhibition(id, {
      status: ExhibitionStatus.MAP_CONFIRMED,
      mapConfirmedAt: new Date(),
    });
  }

  async submitPartnerExhibition(user: AuthenticatedUser, id: string) {
    const exhibition = await this.findPartnerExhibition(user, id);

    if (
      exhibition.status !== ExhibitionStatus.MAP_CONFIRMED &&
      exhibition.status !== ExhibitionStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only confirmed or rejected exhibitions can be submitted',
      );
    }

    if (!exhibition.mapConfirmedAt) {
      throw new BadRequestException('Map must be confirmed before submission');
    }

    const boothsCount = await this.exhibitionsRepository.countActiveBooths(id);
    if (boothsCount === 0) {
      throw new BadRequestException('At least one booth is required');
    }

    const updated = await this.exhibitionsRepository.updateExhibition(id, {
      status: ExhibitionStatus.PENDING_APPROVAL,
      rejectionReason: null,
      approvedAt: null,
    });

    await this.notifyExhibitionSubmitted(id);

    return updated;
  }

  findAdminExhibitions(query: QueryExhibitionsDto) {
    return this.exhibitionsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildWhere(query),
      include: this.exhibitionsRepository.listInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminExhibition(id: string) {
    const exhibition = await this.exhibitionsRepository.findById(id);

    if (!exhibition) {
      throw new NotFoundException('Exhibition not found');
    }

    return this.withExhibitionBoothEffectiveColors(exhibition);
  }

  async approveExhibition(id: string) {
    const exhibition = await this.findAdminExhibition(id);

    if (exhibition.status !== ExhibitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending exhibitions can be approved');
    }

    return this.exhibitionsRepository.updateExhibition(id, {
      status: ExhibitionStatus.APPROVED,
      approvedAt: new Date(),
      rejectionReason: null,
    });
  }

  async rejectExhibition(id: string, rejectExhibitionDto: RejectExhibitionDto) {
    await this.findAdminExhibition(id);

    return this.exhibitionsRepository.updateExhibition(id, {
      status: ExhibitionStatus.REJECTED,
      rejectionReason: rejectExhibitionDto.reason,
      approvedAt: null,
    });
  }

  async archiveExhibition(id: string) {
    await this.findAdminExhibition(id);

    return this.exhibitionsRepository.updateExhibition(id, {
      status: ExhibitionStatus.ARCHIVED,
    });
  }

  async deleteAdminExhibition(id: string) {
    await this.findAdminExhibition(id);
    await this.exhibitionsRepository.softDeleteExhibition(id, new Date());

    return { message: 'Exhibition deleted successfully' };
  }

  async uploadAdminMapFiles(id: string, request: FastifyRequest) {
    const exhibition = await this.findAdminExhibition(id);

    if (exhibition.status === ExhibitionStatus.ARCHIVED) {
      throw new BadRequestException(
        'Archived exhibitions cannot replace map files',
      );
    }

    const upload = await this.parseAndStoreMapFilesUpload(request, id);

    try {
      return await this.exhibitionsRepository.updateExhibition(
        id,
        this.toMapFilesUpdateData(upload, exhibition.status),
      );
    } catch (error) {
      await this.deleteStoredMapFiles(upload);
      throw error;
    }
  }

  async createAdminBooth(
    exhibitionId: string,
    createBoothDto: CreateExhibitionBoothDto,
  ) {
    await this.findAdminExhibition(exhibitionId);
    this.validateCoordinates(createBoothDto.shape, createBoothDto.coordinates);
    await this.validateBoothSector(exhibitionId, createBoothDto.sectorId);

    try {
      const booth = await this.exhibitionsRepository.createBooth({
        exhibitionId,
        sectorId: createBoothDto.sectorId,
        code: createBoothDto.code,
        title: createBoothDto.title,
        description: createBoothDto.description,
        price: createBoothDto.price ?? createBoothDto.localPrice,
        localPrice: createBoothDto.localPrice,
        internationalPrice: createBoothDto.internationalPrice,
        setupPrice: createBoothDto.setupPrice ?? 0,
        currency: createBoothDto.currency ?? 'USD',
        status: createBoothDto.status ?? ExhibitionBoothStatus.AVAILABLE,
        shape: createBoothDto.shape,
        coordinates: createBoothDto.coordinates as unknown as Prisma.InputJsonValue,
        area: createBoothDto.area,
        sortOrder: createBoothDto.sortOrder ?? 0,
      });

      return this.withBoothEffectiveColor(booth);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Booth code already exists');
      }

      throw error;
    }
  }

  async findAdminBooths(
    exhibitionId: string,
    query: QueryExhibitionBoothsDto,
  ) {
    await this.findAdminExhibition(exhibitionId);

    return this.paginateBooths(exhibitionId, query);
  }

  async findAdminBooth(exhibitionId: string, boothId: string) {
    await this.findAdminExhibition(exhibitionId);

    const booth = await this.findBoothOrThrow(exhibitionId, boothId);

    return this.withBoothEffectiveColor(booth);
  }

  async updateAdminBooth(
    exhibitionId: string,
    boothId: string,
    updateBoothDto: UpdateExhibitionBoothDto,
  ) {
    await this.findAdminExhibition(exhibitionId);
    const booth = await this.findBoothOrThrow(exhibitionId, boothId);
    const shape = updateBoothDto.shape ?? booth.shape;

    if (updateBoothDto.coordinates) {
      this.validateCoordinates(shape, updateBoothDto.coordinates);
    }
    await this.validateBoothSector(exhibitionId, updateBoothDto.sectorId);

    try {
      const updated = await this.exhibitionsRepository.updateBooth(
        boothId,
        this.toBoothUpdateData(updateBoothDto),
      );

      return this.withBoothEffectiveColor(updated);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Booth code already exists');
      }

      throw error;
    }
  }

  async deleteAdminBooth(exhibitionId: string, boothId: string) {
    await this.findAdminExhibition(exhibitionId);
    const booth = await this.findBoothOrThrow(exhibitionId, boothId);

    if (booth.status === ExhibitionBoothStatus.BOOKED) {
      throw new BadRequestException('Booked booths cannot be deleted');
    }

    await this.exhibitionsRepository.updateBooth(boothId, {
      deletedAt: new Date(),
    });

    return { message: 'Exhibition booth deleted successfully' };
  }

  findPublicExhibitions(query: QueryExhibitionsDto) {
    return this.exhibitionsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildPublicWhere(query),
      select: this.exhibitionsRepository.publicListSelect(),
      orderBy: [{ approvedAt: 'desc' }, { startsAt: 'asc' }],
    });
  }

  async findPublicExhibition(slug: string) {
    const exhibition = await this.exhibitionsRepository.findBySlug(
      slug,
      this.buildPublicWhere(),
    );

    if (!exhibition) {
      throw new NotFoundException('Exhibition not found');
    }

    return this.withExhibitionBoothEffectiveColors(exhibition);
  }

  async findPublicExhibitionMapImageUrl(slug: string): Promise<string> {
    const exhibition = await this.findPublicExhibition(slug);

    if (!exhibition.mapImageUrl) {
      throw new NotFoundException('Exhibition map image not found');
    }

    return exhibition.mapImageUrl;
  }

  async findPublicExhibitionMapPdfUrl(slug: string): Promise<string> {
    const exhibition = await this.findPublicExhibition(slug);

    if (!exhibition.mapPdfUrl) {
      throw new NotFoundException('Exhibition map PDF not found');
    }

    return exhibition.mapPdfUrl;
  }

  async findPublicExhibitionMapDownloadUrl(slug: string): Promise<string> {
    const exhibition = await this.findPublicExhibition(slug);
    const url = exhibition.mapPdfUrl ?? exhibition.mapImageUrl;

    if (!url) {
      throw new NotFoundException('Exhibition map not found');
    }

    return url;
  }

  private withBoothEffectiveColor<T extends Record<string, any>>(booth: T) {
    const liveSector =
      booth.sector && !booth.sector.deletedAt
        ? {
            id: booth.sector.id,
            title: booth.sector.title,
            color: booth.sector.color ?? null,
          }
        : null;

    return {
      ...booth,
      sector: liveSector,
      effectiveColor: liveSector?.color ?? null,
    };
  }

  private withExhibitionBoothEffectiveColors<T extends Record<string, any>>(
    exhibition: T,
  ) {
    if (!Array.isArray(exhibition.booths)) {
      return exhibition;
    }

    return {
      ...exhibition,
      booths: exhibition.booths.map((booth: Record<string, any>) =>
        this.withBoothEffectiveColor(booth),
      ),
    };
  }

  private async getPartnerCompanyIdWithSubscription(
    user: AuthenticatedUser,
  ): Promise<string> {
    const companyId = this.getPartnerCompanyId(user);
    const subscription =
      await this.exhibitionsRepository.findActiveExhibitionsSubscription(
        companyId,
      );

    if (!subscription) {
      throw new ForbiddenException(
        'Company is not subscribed to exhibitions service',
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
    query: QueryExhibitionsDto,
    companyId?: string,
  ): Prisma.ExhibitionWhereInput {
    return {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(!companyId && query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { subtitle: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildPublicWhere(
    query: QueryExhibitionsDto = new QueryExhibitionsDto(),
  ): Prisma.ExhibitionWhereInput {
    return {
      status: ExhibitionStatus.APPROVED,
      deletedAt: null,
      company: {
        status: 'ACTIVE',
        deletedAt: null,
        serviceSubscriptions: {
          some: {
            serviceType: ServiceType.EXHIBITIONS,
            status: ServiceSubscriptionStatus.ACTIVE,
          },
        },
      },
      ...(query.city ? { city: query.city } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { subtitle: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildBoothWhere(
    exhibitionId: string,
    query: QueryExhibitionBoothsDto,
  ): Prisma.ExhibitionBoothWhereInput {
    return {
      exhibitionId,
      deletedAt: null,
      ...(query.sectorId ? { sectorId: query.sectorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildSectorWhere(
    exhibitionId: string,
    query: QueryExhibitionSectorsDto,
  ): Prisma.ExhibitionSectorWhereInput {
    return {
      exhibitionId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { text: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async paginateSectors(
    exhibitionId: string,
    query: QueryExhibitionSectorsDto,
  ) {
    const where = this.buildSectorWhere(exhibitionId, query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.exhibitionsRepository.findSectors({
        where,
        select: {
          id: true,
          exhibitionId: true,
          title: true,
          text: true,
          imageUrl: true,
          bullets: true,
          color: true,
          sortOrder: true,
          createdAt: true,
          deletedAt: true,
        },
        skip,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.exhibitionsRepository.countSectors(where),
    ]);
    const totalPages = Math.ceil(total / query.limit);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  private async paginateBooths(
    exhibitionId: string,
    query: QueryExhibitionBoothsDto,
  ) {
    const where = this.buildBoothWhere(exhibitionId, query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.exhibitionsRepository.findBooths({
        where,
        include: {
          sector: {
            select: {
              id: true,
              title: true,
              color: true,
              deletedAt: true,
            },
          },
        },
        skip,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      this.exhibitionsRepository.countBooths(where),
    ]);
    const totalPages = Math.ceil(total / query.limit);

    return {
      data: data.map((booth) => this.withBoothEffectiveColor(booth)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  private async paginateBookingRequests(args: {
    page?: number;
    limit?: number;
    where: Prisma.ExhibitionBookingRequestWhereInput;
    include?: Prisma.ExhibitionBookingRequestInclude;
    orderBy?: Prisma.ExhibitionBookingRequestOrderByWithRelationInput;
  }) {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.exhibitionsRepository.findBookingRequests({
        where: args.where,
        include: args.include,
        orderBy: args.orderBy,
        skip,
        take: limit,
      }),
      this.exhibitionsRepository.countBookingRequests(args.where),
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  private async paginateBookingItems(args: {
    page?: number;
    limit?: number;
    where: Prisma.ExhibitionBookingItemWhereInput;
    select?: Prisma.ExhibitionBookingItemSelect;
    orderBy?: Prisma.ExhibitionBookingItemOrderByWithRelationInput;
  }) {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.exhibitionsRepository.findBookingItems({
        where: args.where,
        select: args.select,
        orderBy: args.orderBy,
        skip,
        take: limit,
      }),
      this.exhibitionsRepository.countBookingItems(args.where),
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  private buildBookingWhere(
    query: QueryExhibitionBookingsDto,
    customerId?: string,
  ): Prisma.ExhibitionBookingRequestWhereInput {
    return {
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(!customerId && query.customerId ? { customerId: query.customerId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.exhibitionId ? { exhibitionId: query.exhibitionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                customerFullName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                customerCompany: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                exhibition: {
                  title: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildBookingItemWhere(
    query: QueryExhibitionBookingItemsDto,
    companyId: string,
  ): Prisma.ExhibitionBookingItemWhereInput {
    return {
      bookingRequest: {
        companyId,
        deletedAt: null,
        ...(query.exhibitionId ? { exhibitionId: query.exhibitionId } : {}),
      },
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { booth: { code: { contains: query.search, mode: 'insensitive' } } },
              { booth: { title: { contains: query.search, mode: 'insensitive' } } },
              {
                bookingRequest: {
                  customerFullName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                bookingRequest: {
                  exhibition: {
                    title: { contains: query.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private async syncExhibitionBookingStatus(bookingRequestId: string) {
    const items =
      await this.exhibitionsRepository.listBookingItemStatuses(
        bookingRequestId,
      );
    const statuses = items.map((item) => item.status);
    const all = (status: ExhibitionBookingItemStatus) =>
      statuses.length > 0 &&
      statuses.every((itemStatus) => itemStatus === status);
    const has = (status: ExhibitionBookingItemStatus) =>
      statuses.includes(status);
    let status: ExhibitionBookingRequestStatus =
      ExhibitionBookingRequestStatus.PENDING_REVIEW;

    if (all(ExhibitionBookingItemStatus.APPROVED)) {
      status = ExhibitionBookingRequestStatus.APPROVED;
    } else if (all(ExhibitionBookingItemStatus.REJECTED)) {
      status = ExhibitionBookingRequestStatus.REJECTED;
    } else if (all(ExhibitionBookingItemStatus.CANCELLED)) {
      status = ExhibitionBookingRequestStatus.CANCELLED;
    } else if (
      has(ExhibitionBookingItemStatus.REJECTED) ||
      (has(ExhibitionBookingItemStatus.APPROVED) &&
        has(ExhibitionBookingItemStatus.REJECTED))
    ) {
      status = ExhibitionBookingRequestStatus.PARTIALLY_REJECTED;
    } else if (
      has(ExhibitionBookingItemStatus.APPROVED) &&
      (has(ExhibitionBookingItemStatus.PENDING) ||
        has(ExhibitionBookingItemStatus.CANCELLED))
    ) {
      status = ExhibitionBookingRequestStatus.PARTIALLY_APPROVED;
    }

    await this.exhibitionsRepository.updateBookingRequestStatus(
      bookingRequestId,
      status,
    );

    return status;
  }

  private async findBoothOrThrow(exhibitionId: string, boothId: string) {
    const booth = await this.exhibitionsRepository.findBoothById(
      boothId,
      exhibitionId,
    );

    if (!booth) {
      throw new NotFoundException('Exhibition booth not found');
    }

    return booth;
  }

  private async findSectorOrThrow(exhibitionId: string, sectorId: string) {
    const sector = await this.exhibitionsRepository.findSectorById(
      sectorId,
      exhibitionId,
    );

    if (!sector) {
      throw new NotFoundException('Exhibition sector not found');
    }

    return sector;
  }

  private ensureBulkLimit(count: number): void {
    if (count < 1 || count > 200) {
      throw new BadRequestException('Bulk booth requests support 1 to 200 items');
    }
  }

  private ensureUniqueValues(values: string[], message: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(message);
    }
  }

  private async validateBulkBoothSectors(
    exhibitionId: string,
    sectorIds: (string | null | undefined)[],
  ): Promise<void> {
    const uniqueSectorIds = Array.from(
      new Set(
        sectorIds.filter(
          (sectorId): sectorId is string =>
            sectorId !== null && sectorId !== undefined,
        ),
      ),
    );

    for (const sectorId of uniqueSectorIds) {
      await this.validateBoothSector(exhibitionId, sectorId);
    }
  }

  private async ensureBulkUpdateCodeUniqueness(
    exhibitionId: string,
    updates: UpdateBulkExhibitionBoothItemDto[],
    existingBoothsById: Map<
      string,
      {
        id: string;
        code: string;
      }
    >,
  ): Promise<void> {
    const finalCodes = updates.map((update) => {
      const booth = existingBoothsById.get(update.id);
      return update.code ?? booth?.code ?? '';
    });
    this.ensureUniqueValues(
      finalCodes,
      'Duplicate booth codes are not allowed in the request',
    );

    const changedCodes = updates
      .filter((update) => {
        const booth = existingBoothsById.get(update.id);
        return update.code !== undefined && update.code !== booth?.code;
      })
      .map((update) => update.code as string);

    if (changedCodes.length === 0) {
      return;
    }

    const conflictingBooths =
      await this.exhibitionsRepository.findActiveBoothsByCodes(
        exhibitionId,
        changedCodes,
      );
    const updatingIds = new Set(updates.map((update) => update.id));

    if (conflictingBooths.some((booth) => !updatingIds.has(booth.id))) {
      throw new ConflictException('Booth code already exists');
    }
  }

  private async validateBoothSector(
    exhibitionId: string,
    sectorId: string | null | undefined,
  ): Promise<void> {
    if (sectorId === null || sectorId === undefined) {
      return;
    }

    const sector = await this.exhibitionsRepository.findSectorById(
      sectorId,
      exhibitionId,
    );

    if (!sector) {
      throw new BadRequestException(
        'Sector must belong to the same exhibition',
      );
    }
  }

  private ensurePartnerCanManageBooths(status: ExhibitionStatus): void {
    if (
      status === ExhibitionStatus.APPROVED ||
      status === ExhibitionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Booths cannot be managed after approval or archival',
      );
    }
  }

  private ensurePartnerCanManageSectors(status: ExhibitionStatus): void {
    if (
      status === ExhibitionStatus.APPROVED ||
      status === ExhibitionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Sectors cannot be managed after approval or archival',
      );
    }
  }

  private ensureBookedBoothPartnerUpdateIsSafe(
    updateBoothDto: UpdateExhibitionBoothDto,
  ): void {
    if (
      updateBoothDto.price !== undefined ||
      updateBoothDto.localPrice !== undefined ||
      updateBoothDto.internationalPrice !== undefined ||
      updateBoothDto.setupPrice !== undefined ||
      updateBoothDto.coordinates !== undefined ||
      updateBoothDto.shape !== undefined ||
      'sectorId' in updateBoothDto ||
      updateBoothDto.status !== undefined ||
      updateBoothDto.code !== undefined ||
      updateBoothDto.currency !== undefined
    ) {
      throw new BadRequestException(
        'Booked booth price, map geometry, sector, code, currency, and status cannot be changed by partners',
      );
    }
  }

  private validateCoordinates(
    shape: ExhibitionMapShape,
    coordinates: { x: number; y: number }[],
  ): void {
    if (!Array.isArray(coordinates)) {
      throw new BadRequestException('coordinates must be an array');
    }

    for (const point of coordinates) {
      if (
        typeof point.x !== 'number' ||
        typeof point.y !== 'number' ||
        point.x < 0 ||
        point.x > 100 ||
        point.y < 0 ||
        point.y > 100
      ) {
        throw new BadRequestException(
          'coordinates x/y values must be numbers between 0 and 100',
        );
      }
    }

    if (
      shape === ExhibitionMapShape.RECTANGLE &&
      coordinates.length !== 2
    ) {
      throw new BadRequestException('RECTANGLE coordinates require 2 points');
    }

    if (shape === ExhibitionMapShape.POLYGON && coordinates.length < 3) {
      throw new BadRequestException(
        'POLYGON coordinates require at least 3 points',
      );
    }
  }

  private resolveBoothPrice(
    booth: {
      localPrice: Prisma.Decimal | number;
      internationalPrice: Prisma.Decimal | number;
      setupPrice: Prisma.Decimal | number;
    },
    customerCompanyScope: CustomerCompanyScope,
  ): number {
    if (customerCompanyScope === CustomerCompanyScope.LOCAL) {
      return Number(booth.localPrice) + Number(booth.setupPrice);
    }

    if (customerCompanyScope === CustomerCompanyScope.INTERNATIONAL) {
      return Number(booth.internationalPrice) + Number(booth.setupPrice);
    }

    throw new BadRequestException('customerCompanyScope is required for pricing');
  }

  private toBoothUpdateData(
    updateBoothDto: UpdateExhibitionBoothDto,
  ): Prisma.ExhibitionBoothUncheckedUpdateInput {
    return {
      ...('sectorId' in updateBoothDto ? { sectorId: updateBoothDto.sectorId } : {}),
      code: updateBoothDto.code,
      title: updateBoothDto.title,
      description: updateBoothDto.description,
      price: updateBoothDto.price,
      localPrice: updateBoothDto.localPrice,
      internationalPrice: updateBoothDto.internationalPrice,
      setupPrice: updateBoothDto.setupPrice,
      currency: updateBoothDto.currency,
      status: updateBoothDto.status,
      shape: updateBoothDto.shape,
      coordinates: updateBoothDto.coordinates
        ? (updateBoothDto.coordinates as unknown as Prisma.InputJsonValue)
        : undefined,
      area: updateBoothDto.area,
      sortOrder: updateBoothDto.sortOrder,
    };
  }

  private toBoothCreateData(
    exhibitionId: string,
    createBoothDto: CreateExhibitionBoothDto,
  ): Prisma.ExhibitionBoothUncheckedCreateInput {
    return {
      exhibitionId,
      sectorId: createBoothDto.sectorId,
      code: createBoothDto.code,
      title: createBoothDto.title,
      description: createBoothDto.description,
      price: createBoothDto.price ?? createBoothDto.localPrice,
      localPrice: createBoothDto.localPrice,
      internationalPrice: createBoothDto.internationalPrice,
      setupPrice: createBoothDto.setupPrice ?? 0,
      currency: createBoothDto.currency ?? 'USD',
      status: createBoothDto.status ?? ExhibitionBoothStatus.AVAILABLE,
      shape: createBoothDto.shape,
      coordinates:
        createBoothDto.coordinates as unknown as Prisma.InputJsonValue,
      area: createBoothDto.area,
      sortOrder: createBoothDto.sortOrder ?? 0,
    };
  }

  private toSectorCreateData(
    exhibitionId: string,
    createSectorDto: CreateExhibitionSectorDto,
  ): Prisma.ExhibitionSectorUncheckedCreateInput {
    return {
      exhibitionId,
      title: createSectorDto.title,
      text: createSectorDto.text,
      imageUrl: createSectorDto.imageUrl,
      color: createSectorDto.color,
      bullets: createSectorDto.bullets as Prisma.InputJsonValue,
      sortOrder: createSectorDto.sortOrder ?? 0,
    };
  }

  private toSectorUpdateData(
    updateSectorDto: UpdateExhibitionSectorDto,
  ): Prisma.ExhibitionSectorUncheckedUpdateInput {
    return {
      title: updateSectorDto.title,
      text: updateSectorDto.text,
      imageUrl: updateSectorDto.imageUrl,
      color: updateSectorDto.color,
      bullets: updateSectorDto.bullets as Prisma.InputJsonValue,
      sortOrder: updateSectorDto.sortOrder,
    };
  }

  private toExhibitionData(
    dto: ExhibitionDataDto | UpdateExhibitionDto,
  ): {
    data: Partial<Omit<
      Prisma.ExhibitionUncheckedCreateInput,
      'companyId' | 'slug' | 'status'
    >>;
    content: ExhibitionContentInput;
  } {
    return {
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        description: dto.description,
        heroImageUrl: dto.heroImageUrl,
        secondaryHeroImageUrl: dto.secondaryHeroImageUrl,
        visitorCount: dto.visitorCount,
        participantCount: dto.participantCount,
        participationDays: dto.participationDays,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        venueName: dto.venueName,
        country: dto.country,
        province: dto.province,
        city: dto.city,
        addressText: dto.addressText,
      },
      content: {
        aboutCards: dto.aboutCards?.map((item) => ({
          title: item.title,
          text: item.text,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder ?? 0,
        })),
        sectors: dto.sectors?.map((item) => ({
          title: item.title,
          text: item.text,
          imageUrl: item.imageUrl,
          color: item.color,
          bullets: item.bullets as Prisma.InputJsonValue,
          sortOrder: item.sortOrder ?? 0,
        })),
        participationFeatures: dto.participationFeatures?.map((item) => ({
          title: item.title,
          text: item.text,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder ?? 0,
        })),
      },
    };
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = this.slugify(title) || 'exhibition';
    let slug = baseSlug;
    let suffix = 1;

    while (await this.exhibitionsRepository.findSlug(slug)) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async parseAndStoreMapFilesUpload(
    request: FastifyRequest,
    exhibitionId: string,
  ): Promise<ParsedMapFilesUpload> {
    const multipartRequest = request as MultipartFastifyRequest;

    if (!multipartRequest.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const maxUploadSizeMb =
      this.configService.getOrThrow<number>('maxUploadSizeMb');
    const upload: ParsedMapFilesUpload = {};

    try {
      for await (const part of multipartRequest.parts({
        limits: {
          fileSize: maxUploadSizeMb * 1024 * 1024,
          files: 2,
          fields: 0,
          parts: 2,
        },
      })) {
        if (part.type !== 'file') {
          throw new BadRequestException('Only map files are accepted');
        }

        if (part.fieldname === 'mapImage') {
          if (upload.mapImage) {
            throw new BadRequestException('Only one mapImage file is allowed');
          }

          upload.mapImage = await this.storeMapImage(part, exhibitionId);
          continue;
        }

        if (part.fieldname === 'mapPdf') {
          if (upload.mapPdf) {
            throw new BadRequestException('Only one mapPdf file is allowed');
          }

          upload.mapPdf = await this.storeMapPdf(part, exhibitionId);
          continue;
        }

        throw new BadRequestException(
          'File fields must be named mapImage or mapPdf',
        );
      }
    } catch (error) {
      await this.deleteStoredMapFiles(upload);

      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (!upload.mapImage && !upload.mapPdf) {
      throw new BadRequestException('At least one map file is required');
    }

    return upload;
  }

  private toMapFilesUpdateData(
    upload: ParsedMapFilesUpload,
    status: ExhibitionStatus,
  ): Prisma.ExhibitionUpdateInput {
    const data: Prisma.ExhibitionUpdateInput = {};

    if (upload.mapImage?.url) {
      data.mapImageUrl = upload.mapImage.url;
    }

    if (upload.mapPdf?.url) {
      data.mapPdfUrl = upload.mapPdf.url;
    }

    if (!data.mapImageUrl && !data.mapPdfUrl) {
      throw new BadRequestException(
        'No valid map files received. Use multipart file fields mapImage and/or mapPdf.',
      );
    }

    if (status === ExhibitionStatus.DRAFT) {
      data.status = ExhibitionStatus.MAP_IN_PROGRESS;
    }

    return data;
  }

  private async parseSingleBusinessProofUpload(
    request: FastifyRequest,
  ): Promise<StoredMapFile> {
    const multipartRequest = request as MultipartFastifyRequest;

    if (!multipartRequest.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const maxUploadSizeMb =
      this.configService.getOrThrow<number>('maxUploadSizeMb');
    let upload: StoredMapFile | undefined;

    try {
      for await (const part of multipartRequest.parts({
        limits: {
          fileSize: maxUploadSizeMb * 1024 * 1024,
          files: 1,
          fields: 0,
          parts: 1,
        },
      })) {
        if (part.type !== 'file' || part.fieldname !== 'commercialRegistry') {
          throw new BadRequestException(
            'File field must be named commercialRegistry',
          );
        }

        upload = await this.storeBusinessProofFile(part, 'commercial-registry');
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
      throw new BadRequestException('commercialRegistry file is required');
    }

    return upload;
  }

  private async parseAndStoreHeroImagesUpload(
    request: FastifyRequest,
  ): Promise<ParsedHeroImagesUpload> {
    const multipartRequest = request as MultipartFastifyRequest;

    if (!multipartRequest.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const maxUploadSizeMb =
      this.configService.getOrThrow<number>('maxUploadSizeMb');
    const upload: ParsedHeroImagesUpload = {};

    try {
      for await (const part of multipartRequest.parts({
        limits: {
          fileSize: maxUploadSizeMb * 1024 * 1024,
          files: 2,
          fields: 1,
          parts: 3,
        },
      })) {
        if (part.type === 'field') {
          if (part.fieldname !== 'metadata') {
            throw new BadRequestException('Only metadata field is accepted');
          }

          if (upload.metadata) {
            throw new BadRequestException('Only one metadata field is allowed');
          }

          upload.metadata = this.parseCreateExhibitionMetadata(part.value);
          continue;
        }

        if (part.fieldname === 'heroImage') {
          if (upload.heroImage) {
            throw new BadRequestException('Only one heroImage file is allowed');
          }

          upload.heroImage = await this.storeHeroImage(part, 'hero');
          continue;
        }

        if (part.fieldname === 'secondaryHeroImage') {
          if (upload.secondaryHeroImage) {
            throw new BadRequestException(
              'Only one secondaryHeroImage file is allowed',
            );
          }

          upload.secondaryHeroImage = await this.storeHeroImage(
            part,
            'secondary-hero',
            'secondaryHeroImage',
          );
          continue;
        }

        throw new BadRequestException(
          'File fields must be named heroImage or secondaryHeroImage',
        );
      }
    } catch (error) {
      await this.deleteStoredHeroImages(upload);

      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (!upload.metadata) {
      await this.deleteStoredHeroImages(upload);
      throw new BadRequestException('metadata field is required');
    }

    if (!upload.heroImage) {
      await this.deleteStoredHeroImages(upload);
      throw new BadRequestException('heroImage file is required');
    }

    return upload;
  }

  private parseCreateExhibitionMetadata(value: unknown): CreateExhibitionDto {
    let parsed: unknown;

    try {
      parsed = JSON.parse(String(value ?? ''));
    } catch {
      throw new BadRequestException('metadata must be valid JSON');
    }

    const dto = plainToInstance(CreateExhibitionDto, parsed);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return dto;
  }

  private storeMapImage(file: MultipartFile, exhibitionId: string) {
    const extension = ALLOWED_MAP_IMAGE_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException(
        'mapImage must be a JPEG, PNG, or WebP image',
      );
    }

    return this.storeMultipartMapFile(file, exhibitionId, extension);
  }

  private storeMapPdf(file: MultipartFile, exhibitionId: string) {
    if (file.mimetype !== MAP_PDF_MIME_TYPE) {
      throw new BadRequestException('mapPdf must be an application/pdf file');
    }

    return this.storeMultipartMapFile(file, exhibitionId, '.pdf');
  }

  private storeBusinessProofFile(file: MultipartFile, entityId: string) {
    const extension = ALLOWED_BUSINESS_PROOF_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException(
        'commercialRegistry must be a JPEG, PNG, WebP, or PDF file',
      );
    }

    return this.storeMultipartFile(
      file,
      BUSINESS_PROOF_UPLOAD_DIR,
      entityId,
      extension,
    );
  }

  private storeHeroImage(
    file: MultipartFile,
    entityId: string,
    fieldName = 'heroImage',
  ) {
    const extension = ALLOWED_HERO_IMAGE_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException(
        `${fieldName} must be a JPEG, PNG, or WebP image`,
      );
    }

    return this.storeMultipartFile(
      file,
      EXHIBITION_HERO_UPLOAD_DIR,
      entityId,
      extension,
    );
  }

  private async storeMultipartMapFile(
    file: MultipartFile,
    exhibitionId: string,
    extension: string,
  ): Promise<StoredMapFile> {
    const uploadRoot = this.configService.getOrThrow<string>('uploadRoot');
    const publicBaseUrl =
      this.configService.getOrThrow<string>('publicBaseUrl');
    const uploadDir = resolve(
      process.cwd(),
      uploadRoot,
      EXHIBITION_MAP_UPLOAD_DIR,
    );
    const filename = `${exhibitionId}-${Date.now()}-${randomUUID()}${extension}`;
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

    const publicPath = `${uploadRoot}/${EXHIBITION_MAP_UPLOAD_DIR.replace(/\\/g, '/')}/${filename}`;

    return {
      filePath,
      url: `${publicBaseUrl.replace(/\/$/, '')}/${publicPath}`,
    };
  }

  private async storeMultipartFile(
    file: MultipartFile,
    folder: string,
    entityId: string,
    extension: string,
  ): Promise<StoredMapFile> {
    const uploadRoot = this.configService.getOrThrow<string>('uploadRoot');
    const publicBaseUrl =
      this.configService.getOrThrow<string>('publicBaseUrl');
    const uploadDir = resolve(process.cwd(), uploadRoot, folder);
    const filename = `${entityId}-${Date.now()}-${randomUUID()}${extension}`;
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
      url: `${publicBaseUrl.replace(/\/$/, '')}/${uploadRoot}/${folder.replace(/\\/g, '/')}/${filename}`,
    };
  }

  private async deleteStoredMapFiles(
    upload: ParsedMapFilesUpload,
  ): Promise<void> {
    await Promise.all([
      upload.mapImage ? this.deleteStoredFile(upload.mapImage.filePath) : null,
      upload.mapPdf ? this.deleteStoredFile(upload.mapPdf.filePath) : null,
    ]);
  }

  private async deleteStoredHeroImages(
    upload: ParsedHeroImagesUpload,
  ): Promise<void> {
    await Promise.all([
      upload.heroImage ? this.deleteStoredFile(upload.heroImage.filePath) : null,
      upload.secondaryHeroImage
        ? this.deleteStoredFile(upload.secondaryHeroImage.filePath)
        : null,
    ]);
  }

  private async deleteStoredFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // Best-effort cleanup for partially handled uploads.
    }
  }

  private isMultipartFileTooLargeError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'FST_REQ_FILE_TOO_LARGE'
    );
  }

  private ensureCustomer(user: AuthenticatedUser): void {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException(
        'Only customers can manage exhibition bookings',
      );
    }
  }

  private notifyExhibitionSubmitted(exhibitionId: string) {
    return this.notificationsService.create({
      role: UserRole.SUPER_ADMIN,
      type: NotificationType.SYSTEM,
      title: 'Exhibition submitted for approval',
      message: 'An exhibition was submitted for approval.',
      entityType: 'EXHIBITION',
      entityId: exhibitionId,
    });
  }

  private notifyExhibitionBookingCreated(
    bookingRequestId: string,
    companyId: string,
  ) {
    return this.notificationsService.create({
      companyId,
      type: NotificationType.BOOKING_REQUEST_CREATED,
      title: 'New exhibition booth booking',
      message: 'A customer created an exhibition booth booking request.',
      entityType: 'EXHIBITION_BOOKING_REQUEST',
      entityId: bookingRequestId,
    });
  }

  private notifyExhibitionBookingItemStatusChanged(
    customerId: string,
    bookingItemId: string,
    title: string,
    message: string,
  ) {
    return this.notificationsService.create({
      userId: customerId,
      type: NotificationType.BOOKING_REQUEST_STATUS_CHANGED,
      title,
      message,
      entityType: 'EXHIBITION_BOOKING_ITEM',
      entityId: bookingItemId,
    });
  }

  private notifyExhibitionBookingFullyApproved(
    customerId: string,
    bookingRequestId: string,
  ) {
    return this.notificationsService.create({
      userId: customerId,
      type: NotificationType.BOOKING_REQUEST_STATUS_CHANGED,
      title: 'Exhibition booking approved',
      message: 'All items in your exhibition booking request were approved.',
      entityType: 'EXHIBITION_BOOKING_REQUEST',
      entityId: bookingRequestId,
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
