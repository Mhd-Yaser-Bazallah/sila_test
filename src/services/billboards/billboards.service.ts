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
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BillboardStatus,
  BookingItemType,
  BookingRequestItemStatus,
  BookingRequestStatus,
  BillboardType,
  CustomerCompanyScope,
  InstallationAssignmentStatus,
  InstallationEvidenceType,
  InstallationUnitStatus,
  MediaType,
  NotificationType,
  PricingUnit,
  PrintedSubtype,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../../shared/auth/interfaces/authenticated-user.interface';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { BCRYPT_SALT_ROUNDS } from '../../shared/auth/constants/auth.constants';
import { PrismaService } from '../../shared/database/prisma/prisma.service';
import { AddBillboardMediaDto } from './dto/add-billboard-media.dto';
import { AssignInstallersDto } from './dto/assign-installers.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CreateBillboardDto } from './dto/create-billboard.dto';
import { CreateInstallationEvidenceDto } from './dto/create-installation-evidence.dto';
import { CreateInstallerDto } from './dto/create-installer.dto';
import {
  CreateBookingItemDto,
  CreateMultiBookingRequestDto,
} from './dto/create-multi-booking-request.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRoadBillboardPackageDto } from './dto/create-road-billboard-package.dto';
import { CreateUnavailablePeriodDto } from './dto/create-unavailable-period.dto';
import { QueryBookingItemsDto } from './dto/query-booking-items.dto';
import { QueryBookingRequestsDto } from './dto/query-booking-requests.dto';
import { QueryBillboardsDto } from './dto/query-billboards.dto';
import { QueryInstallationUnitsDto } from './dto/query-installation-units.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { QueryRoadBillboardPackagesDto } from './dto/query-road-billboard-packages.dto';
import { PublicQueryBillboardsDto } from './dto/public-query-billboards.dto';
import { RejectBillboardDto } from './dto/reject-billboard.dto';
import { RequestInstallationRevisionDto } from './dto/request-installation-revision.dto';
import { UpdateBookingRequestStatusDto } from './dto/update-booking-request-status.dto';
import { UpdateBillboardMediaDto } from './dto/update-billboard-media.dto';
import { UpdateBillboardDto } from './dto/update-billboard.dto';
import { RejectBookingItemDto } from './dto/update-booking-item-status.dto';
import { UpdateInstallationCreativeDto } from './dto/update-installation-creative.dto';
import { UpdateInstallerDto } from './dto/update-installer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateRoadBillboardPackageDto } from './dto/update-road-billboard-package.dto';
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

interface StoredUpload {
  url: string;
  filePath: string;
}

interface MultipartBookingUpload {
  metadata: CreateMultiBookingRequestDto;
  creativeImages: Map<string, StoredUpload>;
  creativeFiles: Map<string, StoredUpload>;
  commercialRegistry?: StoredUpload;
}

interface BookingCreativeCreateInput {
  billboardId: string;
  creativeImageUrl?: string;
  creativeFileUrl?: string;
  customerNotes?: string;
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

interface BookingBillboardSnapshot {
  id: string;
  companyId: string;
  price: Prisma.Decimal | number | null;
  localPrice: Prisma.Decimal | number;
  internationalPrice: Prisma.Decimal | number;
  pricingUnit: PricingUnit;
  currency: string;
  taxRatePercent: Prisma.Decimal | number;
}

interface ResolvedBookingItem {
  input: CreateBookingItemDto;
  companyId: string;
  billboardIds: string[];
  priceSnapshot: number | null;
  selectedCustomerCompanyScope: CustomerCompanyScope;
  localPriceSnapshot?: number;
  internationalPriceSnapshot?: number;
  pricingUnit: PricingUnit;
  currency: string;
  taxRatePercent: number;
  taxAmount: number;
  totalBeforeTax: number;
  totalAfterTax: number;
  totalBeforeDiscount?: number;
  totalAfterDiscount?: number;
  discountAmount?: number;
}

interface AvailabilityConflict {
  requestedItemIndex?: number;
  billboardId: string;
  type: 'UNAVAILABLE_PERIOD' | 'APPROVED_BOOKING_ITEM';
  startDate: Date;
  endDate: Date;
  bookingRequestItemId?: string;
}

@Injectable()
export class BillboardsService {
  constructor(
    private readonly billboardsRepository: BillboardsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async createPartnerBillboard(
    user: AuthenticatedUser,
    createBillboardDto: CreateBillboardDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const { submitForApproval, ...billboardData } = createBillboardDto;
    this.ensureBillboardBusinessRules(billboardData);
    const pricingData = this.computeBillboardScopedPrices(billboardData);

    const billboard = await this.billboardsRepository.createBillboard({
      ...billboardData,
      ...pricingData,
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
    const effectiveType = updateBillboardDto.type ?? billboard.type;
    const effectiveBillboard = {
      type: effectiveType,
      printedSubtype:
        effectiveType === BillboardType.PRINTED
          ? updateBillboardDto.printedSubtype ??
            billboard.printedSubtype ??
            undefined
          : undefined,
      pricingUnit: updateBillboardDto.pricingUnit ?? billboard.pricingUnit,
      displayDurationSeconds:
        updateBillboardDto.displayDurationSeconds ??
        (effectiveType === BillboardType.DIGITAL
          ? billboard.displayDurationSeconds ?? undefined
          : undefined),
      localPrice: updateBillboardDto.localPrice ?? Number(billboard.localPrice),
      internationalPrice:
        updateBillboardDto.internationalPrice ??
        Number(billboard.internationalPrice),
      localFlexPrice:
        effectiveType === BillboardType.PRINTED
          ? updateBillboardDto.localFlexPrice ??
            (billboard.localFlexPrice === null
              ? undefined
              : Number(billboard.localFlexPrice))
          : undefined,
      internationalFlexPrice:
        effectiveType === BillboardType.PRINTED
          ? updateBillboardDto.internationalFlexPrice ??
            (billboard.internationalFlexPrice === null
              ? undefined
              : Number(billboard.internationalFlexPrice))
          : undefined,
      localStandardAddedValue:
        effectiveType === BillboardType.PRINTED
          ? updateBillboardDto.localStandardAddedValue ??
            (billboard.localStandardAddedValue === null
              ? undefined
              : Number(billboard.localStandardAddedValue))
          : undefined,
      internationalStandardAddedValue:
        effectiveType === BillboardType.PRINTED
          ? updateBillboardDto.internationalStandardAddedValue ??
            (billboard.internationalStandardAddedValue === null
              ? undefined
              : Number(billboard.internationalStandardAddedValue))
          : undefined,
    };
    this.ensureBillboardBusinessRules(effectiveBillboard);
    const pricingData = this.computeBillboardScopedPrices(effectiveBillboard);

    const updatedBillboard = await this.billboardsRepository.updateBillboard(
      id,
      {
        ...updateBillboardDto,
        ...pricingData,
        ...(effectiveType !== BillboardType.DIGITAL
          ? { displayDurationSeconds: null }
          : {}),
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

  async createPartnerRoadPackage(
    user: AuthenticatedUser,
    createPackageDto: CreateRoadBillboardPackageDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const status = createPackageDto.status ?? BillboardStatus.DRAFT;

    this.ensureDistinctPackageCoordinates(createPackageDto);
    this.ensureRoadPackageBillboardDefaults(createPackageDto);

    const roadPackage =
      await this.billboardsRepository.createRoadPackageWithBillboards({
        packageData: {
          companyId,
          title: createPackageDto.title,
          description: createPackageDto.description,
          startLatitude: createPackageDto.startLatitude,
          startLongitude: createPackageDto.startLongitude,
          endLatitude: createPackageDto.endLatitude,
          endLongitude: createPackageDto.endLongitude,
          billboardsCount: createPackageDto.billboardsCount,
          distanceBetweenBoards: createPackageDto.distanceBetweenBoards,
          direction: createPackageDto.direction,
          status,
        },
        billboards: this.buildRoadPackageBillboards(
          companyId,
          createPackageDto,
          status,
        ),
      });

    if (status === BillboardStatus.PENDING_APPROVAL) {
      await this.notifyRoadPackageSubmitted(roadPackage.id);
    }

    return roadPackage;
  }

  async findPartnerRoadPackages(
    user: AuthenticatedUser,
    query: QueryRoadBillboardPackagesDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);

    return this.paginateRoadPackages({
      page: query.page,
      limit: query.limit,
      where: this.buildRoadPackageWhere(query, companyId),
      include: this.billboardsRepository.roadPackageListInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPartnerRoadPackage(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const roadPackage = await this.billboardsRepository.findCompanyRoadPackage(
      id,
      companyId,
    );

    if (!roadPackage) {
      throw new NotFoundException('Road billboard package not found');
    }

    return roadPackage;
  }

  async updatePartnerRoadPackage(
    user: AuthenticatedUser,
    id: string,
    updatePackageDto: UpdateRoadBillboardPackageDto,
  ) {
    const roadPackage = await this.findPartnerRoadPackage(user, id);
    const directionChanged =
      updatePackageDto.direction !== undefined &&
      updatePackageDto.direction !== roadPackage.direction;

    return this.billboardsRepository.updateRoadPackageAndMaybeBillboards(
      id,
      {
        title: updatePackageDto.title,
        description: updatePackageDto.description,
        direction: updatePackageDto.direction,
        distanceBetweenBoards: updatePackageDto.distanceBetweenBoards,
      },
      directionChanged ? { direction: updatePackageDto.direction } : undefined,
    );
  }

  async submitPartnerRoadPackage(user: AuthenticatedUser, id: string) {
    const roadPackage = await this.findPartnerRoadPackage(user, id);

    if (roadPackage.status === BillboardStatus.ARCHIVED) {
      throw new BadRequestException('Archived packages cannot be submitted');
    }

    if (
      roadPackage.status !== BillboardStatus.DRAFT &&
      roadPackage.status !== BillboardStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only draft or rejected packages can be submitted',
      );
    }

    const updatedRoadPackage =
      await this.billboardsRepository.updateRoadPackageAndMaybeBillboards(
        id,
        {
          status: BillboardStatus.PENDING_APPROVAL,
          rejectionReason: null,
          approvedAt: null,
        },
        {
          status: BillboardStatus.PENDING_APPROVAL,
          rejectionReason: null,
          approvedAt: null,
        },
      );

    await this.notifyRoadPackageSubmitted(id);

    return updatedRoadPackage;
  }

  async deletePartnerRoadPackage(user: AuthenticatedUser, id: string) {
    await this.findPartnerRoadPackage(user, id);

    return this.billboardsRepository.softDeleteRoadPackage(id, new Date());
  }

  findAdminRoadPackages(query: QueryRoadBillboardPackagesDto) {
    return this.paginateRoadPackages({
      page: query.page,
      limit: query.limit,
      where: this.buildRoadPackageWhere(query),
      include: this.billboardsRepository.roadPackageListInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminRoadPackage(id: string) {
    const roadPackage = await this.billboardsRepository.findRoadPackageById(id);

    if (!roadPackage) {
      throw new NotFoundException('Road billboard package not found');
    }

    return roadPackage;
  }

  async approveRoadPackage(id: string) {
    await this.findAdminRoadPackage(id);
    const approvedAt = new Date();

    return this.billboardsRepository.updateRoadPackageAndMaybeBillboards(
      id,
      {
        status: BillboardStatus.APPROVED,
        approvedAt,
        rejectionReason: null,
      },
      {
        status: BillboardStatus.APPROVED,
        approvedAt,
        rejectionReason: null,
      },
    );
  }

  async rejectRoadPackage(id: string, rejectBillboardDto: RejectBillboardDto) {
    await this.findAdminRoadPackage(id);

    return this.billboardsRepository.updateRoadPackageAndMaybeBillboards(
      id,
      {
        status: BillboardStatus.REJECTED,
        rejectionReason: rejectBillboardDto.reason,
        approvedAt: null,
      },
      {
        status: BillboardStatus.REJECTED,
        rejectionReason: rejectBillboardDto.reason,
        approvedAt: null,
      },
    );
  }

  async archiveRoadPackage(id: string) {
    await this.findAdminRoadPackage(id);

    return this.billboardsRepository.updateRoadPackageAndMaybeBillboards(
      id,
      {
        status: BillboardStatus.ARCHIVED,
      },
      {
        status: BillboardStatus.ARCHIVED,
      },
    );
  }

  async createPartnerOffer(
    user: AuthenticatedUser,
    createOfferDto: CreateOfferDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);

    this.ensureValidDateRange(createOfferDto.startsAt, createOfferDto.endsAt);

    const pricing = await this.calculateOfferPricing(
      companyId,
      createOfferDto.billboardIds,
      createOfferDto.localDiscountedTotalPrice,
      createOfferDto.internationalDiscountedTotalPrice,
    );
    const offer = await this.billboardsRepository.createOfferWithItems({
      offerData: {
        companyId,
        title: createOfferDto.title,
        description: createOfferDto.description,
        startsAt: createOfferDto.startsAt,
        endsAt: createOfferDto.endsAt,
        originalTotalPrice: pricing.localOriginalTotalPrice,
        discountedTotalPrice: createOfferDto.localDiscountedTotalPrice,
        localOriginalTotalPrice: pricing.localOriginalTotalPrice,
        internationalOriginalTotalPrice: pricing.internationalOriginalTotalPrice,
        localDiscountedTotalPrice: createOfferDto.localDiscountedTotalPrice,
        internationalDiscountedTotalPrice:
          createOfferDto.internationalDiscountedTotalPrice,
        currency: createOfferDto.currency ?? 'USD',
        status: BillboardStatus.APPROVED,
        approvedAt: new Date(),
      },
      items: pricing.items,
    });

    return this.withOfferDiscountAmount(offer);
  }

  async findPartnerOffers(user: AuthenticatedUser, query: QueryOffersDto) {
    const companyId = this.getPartnerCompanyId(user);
    const result = await this.paginateOffers({
      page: query.page,
      limit: query.limit,
      where: this.buildOfferWhere(query, companyId),
      include: this.billboardsRepository.offerListInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((offer) => this.withOfferDiscountAmount(offer)),
    };
  }

  async findPartnerOffer(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const offer = await this.billboardsRepository.findCompanyOffer(
      id,
      companyId,
    );

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return this.withOfferDiscountAmount(offer);
  }

  async updatePartnerOffer(
    user: AuthenticatedUser,
    id: string,
    updateOfferDto: UpdateOfferDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);
    const offer = await this.billboardsRepository.findCompanyOffer(
      id,
      companyId,
    );

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status === BillboardStatus.ARCHIVED) {
      throw new BadRequestException('Archived offers cannot be edited');
    }

    const startsAt = updateOfferDto.startsAt ?? offer.startsAt;
    const endsAt = updateOfferDto.endsAt ?? offer.endsAt;
    this.ensureValidDateRange(startsAt, endsAt);

    const pricing = updateOfferDto.billboardIds
      ? await this.calculateOfferPricing(
          companyId,
          updateOfferDto.billboardIds,
          updateOfferDto.localDiscountedTotalPrice ??
            Number(offer.localDiscountedTotalPrice),
          updateOfferDto.internationalDiscountedTotalPrice ??
            Number(offer.internationalDiscountedTotalPrice),
        )
      : {
          localOriginalTotalPrice: Number(offer.localOriginalTotalPrice),
          internationalOriginalTotalPrice: Number(
            offer.internationalOriginalTotalPrice,
          ),
          items: undefined,
        };
    const localDiscountedTotalPrice =
      updateOfferDto.localDiscountedTotalPrice ??
      updateOfferDto.discountedTotalPrice ??
      Number(offer.localDiscountedTotalPrice);
    const internationalDiscountedTotalPrice =
      updateOfferDto.internationalDiscountedTotalPrice ??
      Number(offer.internationalDiscountedTotalPrice);

    this.ensureOfferDiscountIsValid(
      pricing.localOriginalTotalPrice,
      localDiscountedTotalPrice,
    );
    this.ensureOfferDiscountIsValid(
      pricing.internationalOriginalTotalPrice,
      internationalDiscountedTotalPrice,
    );

    const updatedOffer = await this.billboardsRepository.updateOffer(
      id,
      {
        title: updateOfferDto.title,
        description: updateOfferDto.description,
        startsAt: updateOfferDto.startsAt,
        endsAt: updateOfferDto.endsAt,
        originalTotalPrice: pricing.localOriginalTotalPrice,
        discountedTotalPrice: localDiscountedTotalPrice,
        localOriginalTotalPrice: pricing.localOriginalTotalPrice,
        internationalOriginalTotalPrice: pricing.internationalOriginalTotalPrice,
        localDiscountedTotalPrice,
        internationalDiscountedTotalPrice,
        currency: updateOfferDto.currency,
        status: BillboardStatus.APPROVED,
        rejectionReason: null,
        approvedAt: offer.approvedAt ?? new Date(),
      },
      pricing.items,
    );

    return this.withOfferDiscountAmount(updatedOffer);
  }

  async submitPartnerOffer(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const offer = await this.billboardsRepository.findCompanyOffer(
      id,
      companyId,
    );

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status === BillboardStatus.ARCHIVED) {
      throw new BadRequestException('Archived offers cannot be submitted');
    }

    if (
      offer.status !== BillboardStatus.DRAFT &&
      offer.status !== BillboardStatus.REJECTED
    ) {
      throw new BadRequestException('Only draft or rejected offers can be submitted');
    }

    const updatedOffer = await this.billboardsRepository.updateOffer(id, {
      status: BillboardStatus.PENDING_APPROVAL,
      rejectionReason: null,
      approvedAt: null,
    });

    await this.notifyOfferSubmitted(id);

    return this.withOfferDiscountAmount(updatedOffer);
  }

  async deletePartnerOffer(user: AuthenticatedUser, id: string) {
    await this.findPartnerOffer(user, id);

    const deletedOffer = await this.billboardsRepository.softDeleteOffer(
      id,
      new Date(),
    );

    return this.withOfferDiscountAmount(deletedOffer);
  }

  async findAdminOffers(query: QueryOffersDto) {
    const result = await this.paginateOffers({
      page: query.page,
      limit: query.limit,
      where: this.buildOfferWhere(query),
      include: this.billboardsRepository.offerListInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((offer) => this.withOfferDiscountAmount(offer)),
    };
  }

  async findAdminOffer(id: string) {
    const offer = await this.billboardsRepository.findOfferById(id);

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return this.withOfferDiscountAmount(offer);
  }

  async approveOffer(id: string) {
    await this.findAdminOffer(id);

    const offer = await this.billboardsRepository.updateOffer(id, {
      status: BillboardStatus.APPROVED,
      approvedAt: new Date(),
      rejectionReason: null,
    });

    return this.withOfferDiscountAmount(offer);
  }

  async rejectOffer(id: string, rejectBillboardDto: RejectBillboardDto) {
    await this.findAdminOffer(id);

    const offer = await this.billboardsRepository.updateOffer(id, {
      status: BillboardStatus.REJECTED,
      rejectionReason: rejectBillboardDto.reason,
      approvedAt: null,
    });

    return this.withOfferDiscountAmount(offer);
  }

  async archiveOffer(id: string) {
    await this.findAdminOffer(id);

    const offer = await this.billboardsRepository.updateOffer(id, {
      status: BillboardStatus.ARCHIVED,
    });

    return this.withOfferDiscountAmount(offer);
  }

  async findPublicOffers(query: QueryOffersDto) {
    const result = await this.paginateOffers({
      page: query.page,
      limit: query.limit,
      where: this.buildPublicOfferWhere(query),
      include: this.billboardsRepository.publicOfferListInclude(),
      orderBy: { approvedAt: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((offer) => this.toPublicOffer(offer)),
    };
  }

  async findPublicOffer(id: string) {
    const offer = await this.billboardsRepository.findPublicOfferById(
      id,
      this.buildPublicOfferWhere(),
    );

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return this.toPublicOffer(offer);
  }

  async findPublicBillboards(query: PublicQueryBillboardsDto) {
    if (query.availableFrom || query.availableTo) {
      if (!query.availableFrom || !query.availableTo) {
        throw new BadRequestException(
          'availableFrom and availableTo must be provided together',
        );
      }

      this.ensureValidDateRange(query.availableFrom, query.availableTo);

      const billboards = await this.billboardsRepository.findPublicBillboards({
        where: this.buildPublicWhere(query),
        select: this.billboardsRepository.publicSelect(),
        orderBy: { approvedAt: 'desc' },
      });
      const availableIds = await this.filterAvailableBillboardIds(
        billboards.map((billboard) => billboard.id),
        query.availableFrom,
        query.availableTo,
      );
      const availableSet = new Set(availableIds);
      const filtered = billboards.filter((billboard) =>
        availableSet.has(billboard.id),
      );
      const start = (query.page - 1) * query.limit;
      const data = filtered.slice(start, start + query.limit);
      const totalPages = Math.ceil(filtered.length / query.limit);

      return {
        data: data.map((billboard) => this.toPublicBillboard(billboard)),
        meta: {
          page: query.page,
          limit: query.limit,
          total: filtered.length,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPreviousPage: query.page > 1,
        },
      };
    }

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
      this.billboardsRepository.findBulkOverlappingApprovedBookingItems(
        [billboardId],
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
        type: 'APPROVED_BOOKING_ITEM' as const,
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

  async createCustomerMultiBookingRequest(
    user: AuthenticatedUser,
    createBookingDto: CreateMultiBookingRequestDto,
  ) {
    this.ensureCustomer(user);
    createBookingDto.items.forEach((item) =>
      this.ensureValidDateRange(item.startDate, item.endDate),
    );

    const resolvedItems = await this.resolveBookingItems(
      createBookingDto.items,
      createBookingDto.customerCompanyScope,
    );
    const conflicts = await this.findAvailabilityConflictsForResolvedItems(
      resolvedItems,
    );

    if (conflicts.length > 0) {
      throw new BadRequestException({
        message: 'One or more booking items are not available',
        conflicts,
      });
    }

    return this.createCustomerBookingFromResolvedItems(
      user,
      createBookingDto,
      resolvedItems,
    );
  }

  async createCustomerMultipartBookingRequest(
    user: AuthenticatedUser,
    request: FastifyRequest,
  ) {
    this.ensureCustomer(user);
    const upload = await this.parseMultipartBookingUpload(request);

    try {
      upload.metadata.items.forEach((item) =>
        this.ensureValidDateRange(item.startDate, item.endDate),
      );

      const resolvedItems = await this.resolveBookingItems(
        upload.metadata.items,
        upload.metadata.customerCompanyScope,
      );
      const actualBillboardIds = this.resolveActualBillboardIds(resolvedItems);
      const conflicts = await this.findAvailabilityConflictsForResolvedItems(
        resolvedItems,
      );

      if (conflicts.length > 0) {
        throw new BadRequestException({
          message: 'One or more booking items are not available',
          conflicts,
        });
      }

      this.ensureCommercialRegistryUploaded(upload);
      this.ensureCreativesUploadedForBillboards(upload, actualBillboardIds);

      return await this.createCustomerBookingFromResolvedItems(
        user,
        upload.metadata,
        resolvedItems,
        upload.commercialRegistry?.url,
        actualBillboardIds.map((billboardId) => ({
          billboardId,
          creativeImageUrl: upload.creativeImages.get(billboardId)?.url,
          creativeFileUrl: upload.creativeFiles.get(billboardId)?.url,
          customerNotes: upload.metadata.customerNotes,
        })),
      );
    } catch (error) {
      await this.deleteMultipartBookingUploads(upload);
      throw error;
    }
  }

  private async createCustomerBookingFromResolvedItems(
    user: AuthenticatedUser,
    createBookingDto: CreateMultiBookingRequestDto,
    resolvedItems: ResolvedBookingItem[],
    commercialRegistryUrl?: string,
    creatives?: BookingCreativeCreateInput[],
  ) {
    const totals = this.calculateBookingTotals(resolvedItems);
    const legacyFirstItem = resolvedItems[0];
    const bookingRequest =
      await this.billboardsRepository.createBookingRequestWithItems(
        {
          billboardId:
            legacyFirstItem.input.itemType === BookingItemType.BILLBOARD
              ? legacyFirstItem.input.billboardId
              : null,
          customerId: user.id,
          startDate: this.minDate(createBookingDto.items.map((item) => item.startDate)),
          endDate: this.maxDate(createBookingDto.items.map((item) => item.endDate)),
          customerFullName: user.fullName,
          customerEmail: user.email,
          customerPhone: user.phone ?? '',
          customerCompany: createBookingDto.customerCompany,
          customerCompanyScope: createBookingDto.customerCompanyScope,
          customerSector: createBookingDto.customerSector,
          customerNotes: createBookingDto.customerNotes,
          commercialRegistryUrl,
          estimatedPrice: totals.totalAfterTax,
          subtotalBeforeTax: totals.subtotalBeforeTax,
          totalTaxAmount: totals.totalTaxAmount,
          totalAfterTax: totals.totalAfterTax,
          totalBeforeDiscount: totals.totalBeforeDiscount,
          totalAfterDiscount: totals.totalAfterDiscount,
          pricingUnit: legacyFirstItem.pricingUnit,
          currency: legacyFirstItem.currency,
          status: BookingRequestStatus.PENDING_REVIEW,
        },
        resolvedItems.map((item) => this.toBookingRequestItemCreateInput(item)),
      );

    if (creatives?.length) {
      await this.createBookingItemCreatives(bookingRequest, resolvedItems, creatives);
    }

    await this.notifyBookingCreated(bookingRequest.id, resolvedItems);

    const updatedBooking =
      creatives?.length
        ? await this.billboardsRepository.findCustomerBookingRequest(
            bookingRequest.id,
            user.id,
          )
        : bookingRequest;

    return this.withBookingBillboardMainImage(updatedBooking ?? bookingRequest);
  }

  async createCustomerBookingRequest(
    user: AuthenticatedUser,
    billboardId: string,
    createBookingDto: CreateBookingRequestDto,
  ) {
    return this.createCustomerMultiBookingRequest(user, {
      items: [
        {
          itemType: BookingItemType.BILLBOARD,
          billboardId,
          startDate: createBookingDto.startDate,
          endDate: createBookingDto.endDate,
        },
      ],
      customerCompany: createBookingDto.customerCompany,
      customerNotes: createBookingDto.customerNotes,
      customerCompanyScope: createBookingDto.customerCompanyScope,
    });
  }

  private async parseMultipartBookingUpload(
    request: FastifyRequest,
  ): Promise<MultipartBookingUpload> {
    const multipartRequest = this.assertMultipartRequest(request);
    const maxUploadSizeMb = this.configService.getOrThrow<number>(
      'maxUploadSizeMb',
    );
    let metadata: CreateMultiBookingRequestDto | undefined;
    const creativeImages = new Map<string, StoredUpload>();
    const creativeFiles = new Map<string, StoredUpload>();
    let commercialRegistry: StoredUpload | undefined;

    try {
      for await (const part of multipartRequest.parts({
        limits: { fileSize: maxUploadSizeMb * 1024 * 1024, files: 250 },
      })) {
        if (part.type === 'field') {
          if (part.fieldname === 'metadata') {
            metadata = this.parseBookingMetadata(part.value);
          }

          continue;
        }

        if (part.fieldname.startsWith('creativeImage_')) {
          const billboardId = part.fieldname.replace('creativeImage_', '');
          if (creativeImages.has(billboardId)) {
            throw new BadRequestException(
              `Duplicate creativeImage for billboard ${billboardId}`,
            );
          }

          creativeImages.set(
            billboardId,
            await this.storeInstallationUpload(
              part,
              'billboards/creatives',
              billboardId,
              ALLOWED_IMAGE_MIME_TYPES,
            ),
          );
          continue;
        }

        if (part.fieldname.startsWith('creativeFile_')) {
          const billboardId = part.fieldname.replace('creativeFile_', '');
          if (creativeFiles.has(billboardId)) {
            throw new BadRequestException(
              `Duplicate creativeFile for billboard ${billboardId}`,
            );
          }

          creativeFiles.set(
            billboardId,
            await this.storeInstallationUpload(
              part,
              'billboards/creatives',
              billboardId,
              this.creativeFileMimeTypes(),
            ),
          );
          continue;
        }

        if (part.fieldname === 'commercialRegistry') {
          if (commercialRegistry) {
            throw new BadRequestException('Only one commercialRegistry file can be uploaded');
          }

          commercialRegistry = await this.storeInstallationUpload(
            part,
            'business-proofs',
            'commercial-registry',
            this.businessProofMimeTypes(),
          );
          continue;
        }

        throw new BadRequestException(`Unsupported file field ${part.fieldname}`);
      }
    } catch (error) {
      await this.deleteMultipartBookingUploads({
        metadata: metadata ?? ({} as CreateMultiBookingRequestDto),
        creativeImages,
        creativeFiles,
        commercialRegistry,
      });

      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (!metadata) {
      await this.deleteMultipartBookingUploads({
        metadata: {} as CreateMultiBookingRequestDto,
        creativeImages,
        creativeFiles,
        commercialRegistry,
      });
      throw new BadRequestException('metadata field is required');
    }

    return { metadata, creativeImages, creativeFiles, commercialRegistry };
  }

  private parseBookingMetadata(value: unknown): CreateMultiBookingRequestDto {
    let parsed: unknown;

    try {
      parsed = JSON.parse(String(value ?? ''));
    } catch {
      throw new BadRequestException('metadata must be valid JSON');
    }

    const dto = plainToInstance(CreateMultiBookingRequestDto, parsed);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException('metadata validation failed');
    }

    return dto;
  }

  private resolveActualBillboardIds(resolvedItems: ResolvedBookingItem[]) {
    const billboardIds = resolvedItems.flatMap((item) => item.billboardIds);
    const uniqueBillboardIds = Array.from(new Set(billboardIds));

    if (uniqueBillboardIds.length !== billboardIds.length) {
      throw new BadRequestException(
        'Booking items must not contain the same actual billboard more than once',
      );
    }

    return uniqueBillboardIds;
  }

  private ensureCommercialRegistryUploaded(upload: MultipartBookingUpload) {
    if (
      (upload.metadata.customerCompanyScope === CustomerCompanyScope.LOCAL ||
        upload.metadata.customerCompanyScope === CustomerCompanyScope.INTERNATIONAL) &&
      !upload.commercialRegistry
    ) {
      throw new BadRequestException('commercialRegistry file is required');
    }
  }

  private ensureCreativesUploadedForBillboards(
    upload: MultipartBookingUpload,
    billboardIds: string[],
  ) {
    const allowedBillboardIds = new Set(billboardIds);
    const uploadedBillboardIds = new Set([
      ...upload.creativeImages.keys(),
      ...upload.creativeFiles.keys(),
    ]);

    for (const uploadedBillboardId of uploadedBillboardIds) {
      if (!allowedBillboardIds.has(uploadedBillboardId)) {
        throw new BadRequestException(
          `Creative file uploaded for billboard ${uploadedBillboardId}, which is not in this booking`,
        );
      }
    }

    for (const billboardId of billboardIds) {
      if (
        !upload.creativeImages.has(billboardId) &&
        !upload.creativeFiles.has(billboardId)
      ) {
        throw new BadRequestException(
          `creativeImage_${billboardId} or creativeFile_${billboardId} is required`,
        );
      }
    }
  }

  private async deleteMultipartBookingUploads(upload: MultipartBookingUpload) {
    await Promise.all([
      ...Array.from(upload.creativeImages.values()).map((item) =>
        this.deleteStoredFile(item.filePath),
      ),
      ...Array.from(upload.creativeFiles.values()).map((item) =>
        this.deleteStoredFile(item.filePath),
      ),
      upload.commercialRegistry
        ? this.deleteStoredFile(upload.commercialRegistry.filePath)
        : null,
    ]);
  }

  private async createBookingItemCreatives(
    bookingRequest: {
      id: string;
      items?: {
        id: string;
        itemType: BookingItemType;
        billboardId?: string | null;
        roadPackageId?: string | null;
        offerId?: string | null;
        startDate: Date;
        endDate: Date;
      }[];
    },
    resolvedItems: ResolvedBookingItem[],
    creatives: BookingCreativeCreateInput[],
  ) {
    const createdItemsByKey = new Map<string, typeof bookingRequest.items>();

    for (const item of bookingRequest.items ?? []) {
      const key = this.bookingItemMatchKey(item);
      const items = createdItemsByKey.get(key) ?? [];
      items.push(item);
      createdItemsByKey.set(key, items);
    }

    const resolvedItemByBillboardId = new Map<
      string,
      { bookingRequestItemId?: string }
    >();

    for (const resolvedItem of resolvedItems) {
      const key = this.bookingItemMatchKey({
        itemType: resolvedItem.input.itemType,
        billboardId: resolvedItem.input.billboardId,
        roadPackageId: resolvedItem.input.roadPackageId,
        offerId: resolvedItem.input.offerId,
        startDate: resolvedItem.input.startDate,
        endDate: resolvedItem.input.endDate,
      });
      const createdItems = createdItemsByKey.get(key) ?? [];
      const createdItem = createdItems.shift();

      for (const billboardId of resolvedItem.billboardIds) {
        resolvedItemByBillboardId.set(billboardId, {
          bookingRequestItemId: createdItem?.id,
        });
      }
    }

    await this.prisma.bookingItemCreative.createMany({
      data: creatives.map((creative) => ({
        bookingRequestId: bookingRequest.id,
        bookingRequestItemId: resolvedItemByBillboardId.get(creative.billboardId)
          ?.bookingRequestItemId,
        billboardId: creative.billboardId,
        creativeImageUrl: creative.creativeImageUrl,
        creativeFileUrl: creative.creativeFileUrl,
        customerNotes: creative.customerNotes,
      })),
    });
  }

  private bookingItemMatchKey(item: {
    itemType: BookingItemType;
    billboardId?: string | null;
    roadPackageId?: string | null;
    offerId?: string | null;
    startDate: Date;
    endDate: Date;
  }) {
    return [
      item.itemType,
      item.billboardId ?? '',
      item.roadPackageId ?? '',
      item.offerId ?? '',
      item.startDate.toISOString(),
      item.endDate.toISOString(),
    ].join('|');
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
      include: this.billboardsRepository.bookingRequestDetailInclude(),
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

  async findCustomerBookingState(user: AuthenticatedUser, bookingId: string) {
    this.ensureCustomer(user);
    const bookingRequest =
      await this.billboardsRepository.findCustomerBookingRequest(
        bookingId,
        user.id,
      );

    if (!bookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    const installationUnits =
      await this.prisma.billboardInstallationUnit.findMany({
        where: {
          deletedAt: null,
          bookingRequestItem: {
            bookingRequestId: bookingId,
            bookingRequest: { customerId: user.id },
          },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          billboard: { select: this.installationBillboardSelect() },
          bookingRequestItem: {
            select: {
              id: true,
              itemType: true,
              bookingRequestId: true,
              startDate: true,
              endDate: true,
            },
          },
          assignments: {
            select: {
              id: true,
              status: true,
              evidences: {
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  url: true,
                  type: true,
                  notes: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

    const creativesByBillboardId = new Map(
      (bookingRequest.creatives ?? []).map((creative) => [
        creative.billboardId,
        creative,
      ]),
    );

    return {
      bookingId: bookingRequest.id,
      bookingStatus: bookingRequest.status,
      commercialRegistryUrl: bookingRequest.commercialRegistryUrl,
      bookingItems: bookingRequest.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        creatives: item.creatives.map((creative) => ({
          billboardId: creative.billboardId,
          billboard: creative.billboard,
          creativeImageUrl: creative.creativeImageUrl,
          creativeFileUrl: creative.creativeFileUrl,
          hasCreative: Boolean(
            creative.creativeImageUrl || creative.creativeFileUrl,
          ),
        })),
      })),
      creativeStatus: Array.from(creativesByBillboardId.values()).map(
        (creative) => ({
          billboardId: creative.billboardId,
          billboard: creative.billboard,
          creativeImageUrl: creative.creativeImageUrl,
          creativeFileUrl: creative.creativeFileUrl,
          hasCreative: Boolean(
            creative.creativeImageUrl || creative.creativeFileUrl,
          ),
        }),
      ),
      installationUnits: installationUnits.map((unit) => ({
        unitId: unit.id,
        billboard: unit.billboard,
        bookingRequestItem: unit.bookingRequestItem,
        unitStatus: unit.status,
        creativeImageUrl: unit.creativeImageUrl,
        creativeFileUrl: unit.creativeFileUrl,
        companyNotes: unit.companyNotes,
        approvedAt: unit.approvedAt,
        installationProofImages:
          unit.status === InstallationUnitStatus.APPROVED
            ? unit.assignments.flatMap((assignment) =>
                assignment.evidences
                  .filter(
                    (evidence) =>
                      evidence.type === InstallationEvidenceType.IMAGE,
                  )
                  .map((evidence) => ({
                    id: evidence.id,
                    url: evidence.url,
                    notes: evidence.notes,
                    createdAt: evidence.createdAt,
                  })),
              )
            : [],
      })),
      currentStep: this.resolveCustomerBookingCurrentStep(
        bookingRequest.status,
        installationUnits.map((unit) => unit.status),
      ),
      steps: this.buildCustomerBookingSteps(
        bookingRequest.status,
        installationUnits.map((unit) => unit.status),
      ),
    };
  }

  async cancelCustomerBookingRequest(user: AuthenticatedUser, id: string) {
    this.ensureCustomer(user);
    const bookingRequest =
      await this.billboardsRepository.findCustomerBookingRequest(id, user.id);

    if (!bookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    if (
      bookingRequest.status === BookingRequestStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Fully approved booking requests cannot be cancelled',
      );
    }

    await this.billboardsRepository.updateBookingRequest(id, {
      items: {
        updateMany: {
          where: { status: BookingRequestItemStatus.PENDING },
          data: { status: BookingRequestItemStatus.CANCELLED },
        },
      },
    });
    await this.syncBookingRequestStatus(id);
    const updatedBookingRequest =
      await this.billboardsRepository.findCustomerBookingRequest(id, user.id);

    if (!updatedBookingRequest) {
      throw new NotFoundException('Booking request not found');
    }

    return this.withBookingBillboardMainImage(updatedBookingRequest);
  }

  async findAdminBookingRequests(query: QueryBookingRequestsDto) {
    const result = await this.paginateBookingRequests({
      page: query.page,
      limit: query.limit,
      where: this.buildBookingWhere(query),
      include: this.billboardsRepository.bookingRequestDetailInclude(),
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

    if (
      updateStatusDto.status === BookingRequestStatus.APPROVED &&
      bookingRequest.billboardId
    ) {
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

  async findPartnerBookingItems(
    user: AuthenticatedUser,
    query: QueryBookingItemsDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);

    return this.paginateBookingItems({
      page: query.page,
      limit: query.limit,
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.bookingRequestId
          ? { bookingRequestId: query.bookingRequestId }
          : {}),
      },
      include: this.billboardsRepository.partnerBookingItemInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPartnerBookingItem(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const item = await this.billboardsRepository.findPartnerBookingItem(
      id,
      companyId,
    );

    if (!item) {
      throw new NotFoundException('Booking item not found');
    }

    return this.withBookingItemMainImages(item);
  }

  async approvePartnerBookingItem(user: AuthenticatedUser, id: string) {
    const item = await this.findPartnerBookingItem(user, id);

    if (item.status !== BookingRequestItemStatus.PENDING) {
      throw new BadRequestException('Only pending booking items can be approved');
    }

    const resolvedItem = await this.resolveExistingBookingItemForAvailability(
      item,
    );
    const conflicts = await this.findAvailabilityConflictsForResolvedItems(
      [resolvedItem],
      id,
    );

    if (conflicts.length > 0) {
      throw new BadRequestException({
        message: 'Booking item is not available',
        conflicts,
      });
    }

    const updatedItem = await this.billboardsRepository.updateBookingItem(id, {
      status: BookingRequestItemStatus.APPROVED,
      approvedAt: new Date(),
      rejectedAt: null,
    });

    await this.syncBookingRequestStatus(item.bookingRequestId);
    await this.createInstallationUnitsForApprovedItem(id);
    await this.notifyBookingItemStatusChanged(item.bookingRequestId, id);

    return this.withBookingItemMainImages(updatedItem);
  }

  async rejectPartnerBookingItem(
    user: AuthenticatedUser,
    id: string,
    rejectDto: RejectBookingItemDto,
  ) {
    const item = await this.findPartnerBookingItem(user, id);

    if (item.status !== BookingRequestItemStatus.PENDING) {
      throw new BadRequestException('Only pending booking items can be rejected');
    }

    const updatedItem = await this.billboardsRepository.updateBookingItem(id, {
      status: BookingRequestItemStatus.REJECTED,
      partnerNotes: rejectDto.partnerNotes,
      rejectedAt: new Date(),
      approvedAt: null,
    });

    await this.syncBookingRequestStatus(item.bookingRequestId);
    await this.notifyBookingItemStatusChanged(item.bookingRequestId, id);

    return this.withBookingItemMainImages(updatedItem);
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

  async createPartnerInstaller(
    user: AuthenticatedUser,
    createInstallerDto: CreateInstallerDto,
  ) {
    const companyId = await this.getPartnerCompanyIdWithSubscription(user);
    const email = this.normalizeEmail(createInstallerDto.email);
    await this.ensureUserEmailIsAvailable(email);
    const passwordHash = await bcrypt.hash(
      createInstallerDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    return this.prisma.user.create({
      data: {
        fullName: createInstallerDto.fullName,
        email,
        phone: createInstallerDto.phone,
        passwordHash,
        role: UserRole.INSTALLER,
        status: UserStatus.ACTIVE,
        companyId,
      },
      select: this.installerSelect(),
    });
  }

  async findPartnerInstallers(user: AuthenticatedUser) {
    const companyId = this.getPartnerCompanyId(user);

    return this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.INSTALLER,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: this.installerSelect(),
    });
  }

  async findPartnerInstaller(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const installer = await this.prisma.user.findFirst({
      where: {
        id,
        companyId,
        role: UserRole.INSTALLER,
        deletedAt: null,
      },
      select: this.installerSelect(),
    });

    if (!installer) {
      throw new NotFoundException('Installer not found');
    }

    return installer;
  }

  async updatePartnerInstaller(
    user: AuthenticatedUser,
    id: string,
    updateInstallerDto: UpdateInstallerDto,
  ) {
    await this.findPartnerInstaller(user, id);
    const email = updateInstallerDto.email
      ? this.normalizeEmail(updateInstallerDto.email)
      : undefined;

    if (email) {
      await this.ensureUserEmailIsAvailable(email, id);
    }

    const passwordHash = updateInstallerDto.password
      ? await bcrypt.hash(updateInstallerDto.password, BCRYPT_SALT_ROUNDS)
      : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: updateInstallerDto.fullName,
        phone: updateInstallerDto.phone,
        status: updateInstallerDto.status,
        ...(email ? { email } : {}),
        ...(passwordHash ? { passwordHash, refreshTokenHash: null } : {}),
      },
      select: this.installerSelect(),
    });
  }

  async deletePartnerInstaller(user: AuthenticatedUser, id: string) {
    await this.findPartnerInstaller(user, id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        deletedAt: new Date(),
        refreshTokenHash: null,
      },
      select: this.installerSelect(),
    });
  }

  async findCustomerInstallationUnits(
    user: AuthenticatedUser,
    bookingId: string,
  ) {
    await this.ensureCustomerBooking(user, bookingId);

    return this.prisma.billboardInstallationUnit.findMany({
      where: {
        deletedAt: null,
        bookingRequestItem: {
          bookingRequestId: bookingId,
          bookingRequest: { customerId: user.id },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: this.customerInstallationUnitInclude(),
    });
  }

  async uploadCustomerInstallationCreative(
    user: AuthenticatedUser,
    unitId: string,
    request: FastifyRequest,
  ) {
    const unit = await this.findCustomerInstallationUnitForUpdate(user, unitId);
    const upload = await this.parseInstallationCreativeUpload(request, unitId);

    return this.updateCustomerInstallationCreative(user, unit.id, {
      creativeImageUrl: upload.creativeImageUrl,
      creativeFileUrl: upload.creativeFileUrl,
      customerNotes: upload.customerNotes,
    });
  }

  async updateCustomerInstallationCreative(
    user: AuthenticatedUser,
    unitId: string,
    updateCreativeDto: UpdateInstallationCreativeDto,
  ) {
    const unit = await this.findCustomerInstallationUnitForUpdate(user, unitId);

    const creativeEditableStatuses: InstallationUnitStatus[] = [
      InstallationUnitStatus.PENDING_CREATIVE,
      InstallationUnitStatus.REVISION_REQUIRED,
    ];

    if (!creativeEditableStatuses.includes(unit.status)) {
      throw new BadRequestException(
        'Creative can only be uploaded while pending or revision is required',
      );
    }

    if (!updateCreativeDto.creativeImageUrl && !updateCreativeDto.creativeFileUrl) {
      throw new BadRequestException('At least one creative URL is required');
    }

    const updated = await this.prisma.billboardInstallationUnit.update({
      where: { id: unit.id },
      data: {
        creativeImageUrl: updateCreativeDto.creativeImageUrl,
        creativeFileUrl: updateCreativeDto.creativeFileUrl,
        customerNotes: updateCreativeDto.customerNotes,
        status: InstallationUnitStatus.READY_FOR_ASSIGNMENT,
        companyNotes: null,
      },
      include: this.customerInstallationUnitInclude(),
    });

    await this.notificationsService.create({
      companyId: unit.companyId,
      type: NotificationType.SYSTEM,
      title: 'Installation creative uploaded',
      message: 'A customer uploaded creative for a billboard installation.',
      entityType: 'BILLBOARD_INSTALLATION_UNIT',
      entityId: unit.id,
    });

    return updated;
  }

  async findPartnerInstallationUnits(
    user: AuthenticatedUser,
    query: QueryInstallationUnitsDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);
    const where = this.buildInstallationUnitWhere(companyId, query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.prisma.billboardInstallationUnit.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: this.partnerInstallationUnitInclude(),
      }),
      this.prisma.billboardInstallationUnit.count({ where }),
    ]);
    const totalPages = Math.ceil(total / query.limit);

    return {
      data: data.map((unit) => this.withInstallationUnitMainImage(unit)),
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

  async findPartnerInstallationUnit(user: AuthenticatedUser, id: string) {
    const companyId = this.getPartnerCompanyId(user);
    const unit = await this.prisma.billboardInstallationUnit.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.partnerInstallationUnitInclude(),
    });

    if (!unit) {
      throw new NotFoundException('Installation unit not found');
    }

    return this.withInstallationUnitMainImage(unit);
  }

  async assignInstallationUnitInstallers(
    user: AuthenticatedUser,
    unitId: string,
    assignInstallersDto: AssignInstallersDto,
  ) {
    const companyId = this.getPartnerCompanyId(user);
    const unit = await this.findPartnerInstallationUnit(user, unitId);

    const assignableStatuses: InstallationUnitStatus[] = [
      InstallationUnitStatus.READY_FOR_ASSIGNMENT,
      InstallationUnitStatus.ASSIGNED,
      InstallationUnitStatus.REVISION_REQUIRED,
    ];

    if (!assignableStatuses.includes(unit.status)) {
      throw new BadRequestException(
        'Installation unit is not ready for assignment',
      );
    }

    const installerIds = Array.from(new Set(assignInstallersDto.installerIds));
    const installers = await this.prisma.user.findMany({
      where: {
        id: { in: installerIds },
        companyId,
        role: UserRole.INSTALLER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (installers.length !== installerIds.length) {
      throw new BadRequestException(
        'All installers must be active installers in your company',
      );
    }

    await this.prisma.$transaction([
      ...installerIds.map((installerId) =>
        this.prisma.billboardInstallationAssignment.upsert({
          where: {
            installationUnitId_installerId: {
              installationUnitId: unit.id,
              installerId,
            },
          },
          update: {
            notes: assignInstallersDto.notes,
          },
          create: {
            installationUnitId: unit.id,
            installerId,
            assignedByUserId: user.id,
            notes: assignInstallersDto.notes,
          },
        }),
      ),
      this.prisma.billboardInstallationUnit.update({
        where: { id: unit.id },
        data: { status: InstallationUnitStatus.ASSIGNED },
      }),
    ]);

    await Promise.all(
      installerIds.map((installerId) =>
        this.notificationsService.create({
          userId: installerId,
          type: NotificationType.SYSTEM,
          title: 'New installation assignment',
          message: 'You were assigned to a billboard installation.',
          entityType: 'BILLBOARD_INSTALLATION_UNIT',
          entityId: unit.id,
        }),
      ),
    );

    return this.findPartnerInstallationUnit(user, unit.id);
  }

  async approveInstallationUnit(user: AuthenticatedUser, unitId: string) {
    const unit = await this.findPartnerInstallationUnit(user, unitId);

    if (unit.status !== InstallationUnitStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted installation units can be approved');
    }

    const approvedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.billboardInstallationUnit.update({
        where: { id: unit.id },
        data: { status: InstallationUnitStatus.APPROVED, approvedAt },
      }),
      this.prisma.billboardInstallationAssignment.updateMany({
        where: {
          installationUnitId: unit.id,
          status: InstallationAssignmentStatus.SUBMITTED,
        },
        data: { status: InstallationAssignmentStatus.APPROVED, approvedAt },
      }),
    ]);

    await this.notifyInstallationReviewed(unit.id, true);

    return this.findPartnerInstallationUnit(user, unit.id);
  }

  async requestInstallationUnitRevision(
    user: AuthenticatedUser,
    unitId: string,
    requestRevisionDto: RequestInstallationRevisionDto,
  ) {
    const unit = await this.findPartnerInstallationUnit(user, unitId);

    if (unit.status !== InstallationUnitStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only submitted installation units can request revision',
      );
    }

    const revisionRequestedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.billboardInstallationUnit.update({
        where: { id: unit.id },
        data: {
          status: InstallationUnitStatus.REVISION_REQUIRED,
          companyNotes: requestRevisionDto.companyNotes,
        },
      }),
      this.prisma.billboardInstallationAssignment.updateMany({
        where: {
          installationUnitId: unit.id,
          status: InstallationAssignmentStatus.SUBMITTED,
        },
        data: {
          status: InstallationAssignmentStatus.REVISION_REQUIRED,
          revisionRequestedAt,
        },
      }),
    ]);

    await this.notifyInstallationReviewed(unit.id, false);

    return this.findPartnerInstallationUnit(user, unit.id);
  }

  async findInstallerAssignments(user: AuthenticatedUser) {
    return this.prisma.billboardInstallationAssignment.findMany({
      where: { installerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: this.installerAssignmentInclude(),
    });
  }

  async findInstallerAssignment(user: AuthenticatedUser, id: string) {
    const assignment = await this.prisma.billboardInstallationAssignment.findFirst({
      where: { id, installerId: user.id },
      include: this.installerAssignmentInclude(),
    });

    if (!assignment) {
      throw new NotFoundException('Installation assignment not found');
    }

    return assignment;
  }

  async startInstallerAssignment(user: AuthenticatedUser, id: string) {
    const assignment = await this.findInstallerAssignment(user, id);

    const startableStatuses: InstallationAssignmentStatus[] = [
      InstallationAssignmentStatus.ASSIGNED,
      InstallationAssignmentStatus.REVISION_REQUIRED,
    ];

    if (!startableStatuses.includes(assignment.status)) {
      throw new BadRequestException('Assignment cannot be started');
    }

    await this.prisma.$transaction([
      this.prisma.billboardInstallationAssignment.update({
        where: { id: assignment.id },
        data: {
          status: InstallationAssignmentStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      }),
      this.prisma.billboardInstallationUnit.update({
        where: { id: assignment.installationUnitId },
        data: { status: InstallationUnitStatus.IN_PROGRESS },
      }),
    ]);

    return this.findInstallerAssignment(user, assignment.id);
  }

  async uploadInstallerAssignmentEvidence(
    user: AuthenticatedUser,
    id: string,
    request: FastifyRequest,
  ) {
    const assignment = await this.findInstallerAssignment(user, id);
    const upload = await this.parseInstallationEvidenceUpload(request, id);

    return this.submitInstallerAssignmentEvidence(user, assignment.id, upload.items);
  }

  async addInstallerAssignmentEvidence(
    user: AuthenticatedUser,
    id: string,
    createEvidenceDto: CreateInstallationEvidenceDto,
  ) {
    const assignment = await this.findInstallerAssignment(user, id);

    return this.submitInstallerAssignmentEvidence(
      user,
      assignment.id,
      createEvidenceDto.items.map((item) => ({
        url: item.url,
        type: item.type ?? InstallationEvidenceType.IMAGE,
        notes: item.notes,
      })),
    );
  }

  private async createInstallationUnitsForApprovedItem(
    bookingRequestItemId: string,
  ) {
    const item = await this.prisma.bookingRequestItem.findUnique({
      where: { id: bookingRequestItemId },
      select: {
        id: true,
        bookingRequestId: true,
        companyId: true,
        itemType: true,
        billboardId: true,
        roadPackage: { select: { billboards: { select: { id: true } } } },
        offer: { select: { items: { select: { billboardId: true } } } },
      },
    });

    if (!item) {
      return;
    }

    const billboardIds =
      item.itemType === BookingItemType.BILLBOARD
        ? [item.billboardId].filter((id): id is string => Boolean(id))
        : item.itemType === BookingItemType.ROAD_PACKAGE
          ? (item.roadPackage?.billboards ?? []).map((billboard) => billboard.id)
          : (item.offer?.items ?? []).map((offerItem) => offerItem.billboardId);

    if (billboardIds.length === 0) {
      return;
    }

    const creatives = await this.prisma.bookingItemCreative.findMany({
      where: {
        bookingRequestId: item.bookingRequestId,
        billboardId: { in: billboardIds },
      },
      select: {
        billboardId: true,
        creativeImageUrl: true,
        creativeFileUrl: true,
        customerNotes: true,
      },
    });
    const creativeByBillboardId = new Map(
      creatives.map((creative) => [creative.billboardId, creative]),
    );

    await this.prisma.$transaction(
      Array.from(new Set(billboardIds)).map((billboardId) => {
        const creative = creativeByBillboardId.get(billboardId);

        return this.prisma.billboardInstallationUnit.upsert({
          where: {
            bookingRequestItemId_billboardId: {
              bookingRequestItemId: item.id,
              billboardId,
            },
          },
          update: creative
            ? {
                creativeImageUrl: creative.creativeImageUrl,
                creativeFileUrl: creative.creativeFileUrl,
                customerNotes: creative.customerNotes,
                status: InstallationUnitStatus.READY_FOR_ASSIGNMENT,
              }
            : {},
          create: {
            bookingRequestItemId: item.id,
            companyId: item.companyId,
            billboardId,
            creativeImageUrl: creative?.creativeImageUrl,
            creativeFileUrl: creative?.creativeFileUrl,
            customerNotes: creative?.customerNotes,
            status: creative
              ? InstallationUnitStatus.READY_FOR_ASSIGNMENT
              : InstallationUnitStatus.PENDING_CREATIVE,
          },
        });
      }),
    );
  }

  private async ensureCustomerBooking(
    user: AuthenticatedUser,
    bookingId: string,
  ) {
    const booking = await this.prisma.bookingRequest.findFirst({
      where: { id: bookingId, customerId: user.id, deletedAt: null },
      select: { id: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
  }

  private async findCustomerInstallationUnitForUpdate(
    user: AuthenticatedUser,
    unitId: string,
  ) {
    const unit = await this.prisma.billboardInstallationUnit.findFirst({
      where: {
        id: unitId,
        deletedAt: null,
        bookingRequestItem: {
          bookingRequest: { customerId: user.id },
        },
      },
      select: {
        id: true,
        companyId: true,
        status: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Installation unit not found');
    }

    return unit;
  }

  private buildInstallationUnitWhere(
    companyId: string,
    query: QueryInstallationUnitsDto,
  ): Prisma.BillboardInstallationUnitWhereInput {
    return {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.billboardId ? { billboardId: query.billboardId } : {}),
      ...(query.bookingRequestItemId
        ? { bookingRequestItemId: query.bookingRequestItemId }
        : {}),
      ...(query.installerId
        ? { assignments: { some: { installerId: query.installerId } } }
        : {}),
    };
  }

  private async submitInstallerAssignmentEvidence(
    user: AuthenticatedUser,
    assignmentId: string,
    items: { url: string; type: InstallationEvidenceType; notes?: string }[],
  ) {
    if (items.length < 1 || items.length > 10) {
      throw new BadRequestException('Upload between 1 and 10 proof images');
    }

    const assignment = await this.findInstallerAssignment(user, assignmentId);

    const evidenceUploadStatuses: InstallationAssignmentStatus[] = [
      InstallationAssignmentStatus.IN_PROGRESS,
      InstallationAssignmentStatus.REVISION_REQUIRED,
    ];

    if (!evidenceUploadStatuses.includes(assignment.status)) {
      throw new BadRequestException(
        'Evidence can only be uploaded for in-progress or revision assignments',
      );
    }

    await this.prisma.$transaction([
      this.prisma.billboardInstallationEvidence.createMany({
        data: items.map((item) => ({
          assignmentId: assignment.id,
          uploadedByUserId: user.id,
          url: item.url,
          type: item.type,
          notes: item.notes,
        })),
      }),
      this.prisma.billboardInstallationAssignment.update({
        where: { id: assignment.id },
        data: {
          status: InstallationAssignmentStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      }),
    ]);

    await this.markUnitSubmittedIfReady(assignment.installationUnitId);
    await this.notificationsService.create({
      companyId: assignment.installationUnit.companyId,
      type: NotificationType.SYSTEM,
      title: 'Installation proof submitted',
      message: 'An installer submitted proof images for review.',
      entityType: 'BILLBOARD_INSTALLATION_ASSIGNMENT',
      entityId: assignment.id,
    });

    return this.findInstallerAssignment(user, assignment.id);
  }

  private async markUnitSubmittedIfReady(installationUnitId: string) {
    const activeAssignments =
      await this.prisma.billboardInstallationAssignment.findMany({
        where: {
          installationUnitId,
          status: { not: InstallationAssignmentStatus.CANCELLED },
        },
        select: { status: true },
      });

    if (
      activeAssignments.length > 0 &&
      activeAssignments.every((assignment) => {
        const completedStatuses: InstallationAssignmentStatus[] = [
          InstallationAssignmentStatus.SUBMITTED,
          InstallationAssignmentStatus.APPROVED,
        ];

        return completedStatuses.includes(assignment.status);
      })
    ) {
      await this.prisma.billboardInstallationUnit.update({
        where: { id: installationUnitId },
        data: { status: InstallationUnitStatus.SUBMITTED },
      });
    }
  }

  private async parseInstallationCreativeUpload(
    request: FastifyRequest,
    unitId: string,
  ): Promise<{
    creativeImageUrl?: string;
    creativeFileUrl?: string;
    customerNotes?: string;
  }> {
    const multipartRequest = this.assertMultipartRequest(request);
    const maxUploadSizeMb = this.configService.getOrThrow<number>(
      'maxUploadSizeMb',
    );
    let creativeImageUrl: string | undefined;
    let creativeFileUrl: string | undefined;
    let customerNotes: string | undefined;

    try {
      for await (const part of multipartRequest.parts({
        limits: { fileSize: maxUploadSizeMb * 1024 * 1024, files: 2 },
      })) {
        if (part.type === 'file') {
          if (part.fieldname === 'creativeImage') {
            creativeImageUrl = (
              await this.storeInstallationUpload(
                part,
                'billboards/creatives',
                unitId,
                ALLOWED_IMAGE_MIME_TYPES,
              )
            ).url;
          } else if (part.fieldname === 'creativeFile') {
            creativeFileUrl = (
              await this.storeInstallationUpload(
                part,
                'billboards/creatives',
                unitId,
                this.creativeFileMimeTypes(),
              )
            ).url;
          }
        } else if (part.fieldname === 'customerNotes') {
          customerNotes = String(part.value ?? '');
        }
      }
    } catch (error) {
      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (!creativeImageUrl && !creativeFileUrl) {
      throw new BadRequestException('At least one creative file is required');
    }

    return { creativeImageUrl, creativeFileUrl, customerNotes };
  }

  private async parseInstallationEvidenceUpload(
    request: FastifyRequest,
    assignmentId: string,
  ): Promise<{
    items: { url: string; type: InstallationEvidenceType; notes?: string }[];
  }> {
    const multipartRequest = this.assertMultipartRequest(request);
    const maxUploadSizeMb = this.configService.getOrThrow<number>(
      'maxUploadSizeMb',
    );
    const items: { url: string; type: InstallationEvidenceType; notes?: string }[] =
      [];
    let notes: string | undefined;

    try {
      for await (const part of multipartRequest.parts({
        limits: { fileSize: maxUploadSizeMb * 1024 * 1024, files: 10 },
      })) {
        if (part.type === 'file') {
          if (part.fieldname !== 'files') {
            continue;
          }

          const upload = await this.storeInstallationUpload(
            part,
            'billboards/installations',
            assignmentId,
            ALLOWED_IMAGE_MIME_TYPES,
          );
          items.push({ url: upload.url, type: InstallationEvidenceType.IMAGE });
        } else if (part.fieldname === 'notes') {
          notes = String(part.value ?? '');
        }
      }
    } catch (error) {
      if (this.isMultipartFileTooLargeError(error)) {
        throw new BadRequestException(
          `File size must not exceed ${maxUploadSizeMb}MB`,
        );
      }

      throw error;
    }

    if (items.length < 1 || items.length > 10) {
      throw new BadRequestException('Upload between 1 and 10 proof images');
    }

    return {
      items: items.map((item) => ({ ...item, notes })),
    };
  }

  private assertMultipartRequest(request: FastifyRequest) {
    const multipartRequest = request as MultipartFastifyRequest;

    if (!multipartRequest.isMultipart?.()) {
      throw new BadRequestException('multipart/form-data request is required');
    }

    return multipartRequest;
  }

  private async storeInstallationUpload(
    file: MultipartFile,
    folder: string,
    entityId: string,
    allowedMimeTypes: Map<string, string>,
  ): Promise<ParsedMediaUpload> {
    const extension = allowedMimeTypes.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException('Unsupported file type');
    }

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
      url: `${publicBaseUrl.replace(/\/$/, '')}/${uploadRoot}/${folder}/${filename}`,
    };
  }

  private creativeFileMimeTypes() {
    return new Map([...ALLOWED_IMAGE_MIME_TYPES, ['application/pdf', '.pdf']]);
  }

  private businessProofMimeTypes() {
    return new Map([...ALLOWED_IMAGE_MIME_TYPES, ['application/pdf', '.pdf']]);
  }

  private async notifyInstallationReviewed(
    installationUnitId: string,
    approved: boolean,
  ) {
    const unit = await this.prisma.billboardInstallationUnit.findUnique({
      where: { id: installationUnitId },
      select: {
        id: true,
        bookingRequestItem: {
          select: {
            bookingRequest: { select: { customerId: true } },
          },
        },
        assignments: { select: { installerId: true } },
      },
    });

    if (!unit) {
      return;
    }

    await Promise.all([
      this.notificationsService.create({
        userId: unit.bookingRequestItem.bookingRequest.customerId,
        type: NotificationType.SYSTEM,
        title: approved ? 'Installation approved' : 'Installation needs revision',
        message: approved
          ? 'Your billboard installation was approved.'
          : 'A billboard installation needs revision.',
        entityType: 'BILLBOARD_INSTALLATION_UNIT',
        entityId: unit.id,
      }),
      ...unit.assignments.map((assignment) =>
        this.notificationsService.create({
          userId: assignment.installerId,
          type: NotificationType.SYSTEM,
          title: approved
            ? 'Installation proof approved'
            : 'Installation revision requested',
          message: approved
            ? 'Your submitted installation proof was approved.'
            : 'A company admin requested installation revision.',
          entityType: 'BILLBOARD_INSTALLATION_UNIT',
          entityId: unit.id,
        }),
      ),
    ]);
  }

  private async ensureUserEmailIsAvailable(email: string, excludeId?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('User email already exists');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private installerSelect() {
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
    } satisfies Prisma.UserSelect;
  }

  private customerInstallationUnitInclude() {
    return {
      billboard: { select: this.installationBillboardSelect() },
      bookingRequestItem: {
        select: {
          id: true,
          itemType: true,
          bookingRequestId: true,
          startDate: true,
          endDate: true,
        },
      },
    } satisfies Prisma.BillboardInstallationUnitInclude;
  }

  private partnerInstallationUnitInclude() {
    return {
      billboard: { select: this.installationBillboardSelect() },
      bookingRequestItem: {
        select: {
          id: true,
          itemType: true,
          bookingRequestId: true,
          startDate: true,
          endDate: true,
          bookingRequest: {
            select: {
              id: true,
              customerFullName: true,
              customerCompany: true,
              customerCompanyScope: true,
              customerSector: true,
              status: true,
            },
          },
        },
      },
      assignments: {
        orderBy: { createdAt: 'desc' },
        include: {
          installer: { select: this.installerSelect() },
          evidences: { orderBy: { createdAt: 'desc' } },
        },
      },
    } satisfies Prisma.BillboardInstallationUnitInclude;
  }

  private installerAssignmentInclude() {
    return {
      installationUnit: {
        include: {
          billboard: { select: this.installationBillboardSelect() },
          bookingRequestItem: {
            select: {
              id: true,
              itemType: true,
              bookingRequestId: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      },
      evidences: { orderBy: { createdAt: 'desc' } },
    } satisfies Prisma.BillboardInstallationAssignmentInclude;
  }

  private installationBillboardSelect() {
    return {
      id: true,
      title: true,
      country: true,
      province: true,
      city: true,
      addressText: true,
      latitude: true,
      longitude: true,
      width: true,
      height: true,
      hasLighting: true,
      lightingPrice: true,
      type: true,
      direction: true,
      media: { orderBy: this.billboardsRepository.mediaOrderBy() },
    } satisfies Prisma.BillboardSelect;
  }

  private resolveCustomerBookingCurrentStep(
    bookingStatus: BookingRequestStatus,
    installationStatuses: InstallationUnitStatus[],
  ) {
    if (
      bookingStatus === BookingRequestStatus.REJECTED ||
      bookingStatus === BookingRequestStatus.CANCELLED
    ) {
      return 'BOOKING_CLOSED';
    }

    if (
      bookingStatus === BookingRequestStatus.PENDING_REVIEW ||
      bookingStatus === BookingRequestStatus.PARTIALLY_APPROVED ||
      bookingStatus === BookingRequestStatus.PARTIALLY_REJECTED
    ) {
      return 'COMPANY_REVIEW';
    }

    if (installationStatuses.length === 0) {
      return 'INSTALLATION_PENDING';
    }

    if (
      installationStatuses.every(
        (status) => status === InstallationUnitStatus.APPROVED,
      )
    ) {
      return 'INSTALLATION_APPROVED';
    }

    if (
      installationStatuses.some((status) =>
        ([
          InstallationUnitStatus.ASSIGNED,
          InstallationUnitStatus.IN_PROGRESS,
          InstallationUnitStatus.SUBMITTED,
          InstallationUnitStatus.REVISION_REQUIRED,
        ] as InstallationUnitStatus[]).includes(status),
      )
    ) {
      return 'INSTALLATION_IN_PROGRESS';
    }

    return 'READY_FOR_ASSIGNMENT';
  }

  private buildCustomerBookingSteps(
    bookingStatus: BookingRequestStatus,
    installationStatuses: InstallationUnitStatus[],
  ) {
    const bookingApproved = ([
      BookingRequestStatus.APPROVED,
      BookingRequestStatus.PARTIALLY_APPROVED,
      BookingRequestStatus.PARTIALLY_REJECTED,
    ] as BookingRequestStatus[]).includes(bookingStatus);
    const installationStarted = installationStatuses.some((status) =>
      ([
        InstallationUnitStatus.ASSIGNED,
        InstallationUnitStatus.IN_PROGRESS,
        InstallationUnitStatus.SUBMITTED,
        InstallationUnitStatus.REVISION_REQUIRED,
        InstallationUnitStatus.APPROVED,
      ] as InstallationUnitStatus[]).includes(status),
    );
    const installationApproved =
      installationStatuses.length > 0 &&
      installationStatuses.every(
        (status) => status === InstallationUnitStatus.APPROVED,
      );

    return [
      {
        key: 'BOOKING_CREATED',
        status: 'COMPLETED',
      },
      {
        key: 'COMPANY_REVIEW',
        status: bookingApproved ? 'COMPLETED' : 'CURRENT',
      },
      {
        key: 'INSTALLATION',
        status: installationStarted
          ? installationApproved
            ? 'COMPLETED'
            : 'CURRENT'
          : 'PENDING',
      },
      {
        key: 'INSTALLATION_APPROVED',
        status: installationApproved ? 'COMPLETED' : 'PENDING',
      },
    ];
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
    const and: Prisma.BillboardWhereInput[] = [];

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      and.push({
        OR: [
          {
            localPrice: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          },
          {
            internationalPrice: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          },
        ],
      });
    }

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { country: { contains: query.search, mode: 'insensitive' } },
          { province: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
          { addressText: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      status: BillboardStatus.APPROVED,
      deletedAt: null,
      ...(and.length > 0 ? { AND: and } : {}),
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

  private buildRoadPackageWhere(
    query: QueryRoadBillboardPackagesDto,
    companyId?: string,
  ): Prisma.RoadBillboardPackageWhereInput {
    return {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(!companyId && query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildOfferWhere(
    query: QueryOffersDto,
    companyId?: string,
  ): Prisma.OfferWhereInput {
    const now = new Date();

    return {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(!companyId && query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.activeOnly
        ? {
            startsAt: { lte: now },
            endsAt: { gte: now },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildPublicOfferWhere(
    query: QueryOffersDto = new QueryOffersDto(),
  ): Prisma.OfferWhereInput {
    const now = new Date();

    return {
      status: BillboardStatus.APPROVED,
      deletedAt: null,
      startsAt: { lte: now },
      endsAt: { gte: now },
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
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async paginateOffers(args: {
    page: number;
    limit: number;
    where: Prisma.OfferWhereInput;
    include?: Prisma.OfferInclude;
    orderBy?: Prisma.OfferOrderByWithRelationInput;
  }) {
    const skip = (args.page - 1) * args.limit;
    const [data, total] = await Promise.all([
      this.billboardsRepository.findOffers({
        where: args.where,
        include: args.include,
        orderBy: args.orderBy,
        skip,
        take: args.limit,
      }),
      this.billboardsRepository.countOffers(args.where),
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

  private async calculateOfferPricing(
    companyId: string,
    billboardIds: string[],
    localDiscountedTotalPrice: number,
    internationalDiscountedTotalPrice: number,
  ) {
    const billboards = await this.billboardsRepository.findCompanyBillboardsForOffer(
      companyId,
      billboardIds,
    );

    if (billboards.length !== billboardIds.length) {
      throw new BadRequestException(
        'All offer billboards must belong to your company and not be archived',
      );
    }

    const items = billboards.map((billboard) => {
      if (billboard.status !== BillboardStatus.APPROVED) {
        throw new BadRequestException(
          'All offer billboards must be approved',
        );
      }

      return {
        billboardId: billboard.id,
        priceSnapshot: Number(billboard.localPrice),
        localPriceSnapshot: Number(billboard.localPrice),
        internationalPriceSnapshot: Number(billboard.internationalPrice),
      };
    });
    const localOriginalTotalPrice = items.reduce(
      (total, item) => total + Number(item.localPriceSnapshot),
      0,
    );
    const internationalOriginalTotalPrice = items.reduce(
      (total, item) => total + Number(item.internationalPriceSnapshot),
      0,
    );

    this.ensureOfferDiscountIsValid(
      localOriginalTotalPrice,
      localDiscountedTotalPrice,
    );
    this.ensureOfferDiscountIsValid(
      internationalOriginalTotalPrice,
      internationalDiscountedTotalPrice,
    );

    return {
      localOriginalTotalPrice,
      internationalOriginalTotalPrice,
      items,
    };
  }

  private ensureOfferDiscountIsValid(
    originalTotalPrice: number,
    discountedTotalPrice: number,
  ): void {
    if (discountedTotalPrice >= originalTotalPrice) {
      throw new BadRequestException(
        'discountedTotalPrice must be less than originalTotalPrice',
      );
    }
  }

  private async paginateRoadPackages(args: {
    page: number;
    limit: number;
    where: Prisma.RoadBillboardPackageWhereInput;
    include?: Prisma.RoadBillboardPackageInclude;
    orderBy?: Prisma.RoadBillboardPackageOrderByWithRelationInput;
  }) {
    const skip = (args.page - 1) * args.limit;
    const [data, total] = await Promise.all([
      this.billboardsRepository.findRoadPackages({
        where: args.where,
        include: args.include,
        orderBy: args.orderBy,
        skip,
        take: args.limit,
      }),
      this.billboardsRepository.countRoadPackages(args.where),
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

  private buildRoadPackageBillboards(
    companyId: string,
    createPackageDto: CreateRoadBillboardPackageDto,
    status: BillboardStatus,
  ): Prisma.BillboardUncheckedCreateInput[] {
    const defaults = createPackageDto.billboardDefaults;
    const pricingData = this.computeBillboardScopedPrices(defaults);

    return Array.from({ length: createPackageDto.billboardsCount }, (_, i) => {
      const boardNumber = i + 1;
      const ratio =
        createPackageDto.billboardsCount === 1
          ? 0
          : i / (createPackageDto.billboardsCount - 1);

      return {
        companyId,
        title: `${createPackageDto.title} - Board ${boardNumber}`,
        country: defaults.country,
        province: defaults.province,
        city: defaults.city,
        latitude: this.interpolateCoordinate(
          createPackageDto.startLatitude,
          createPackageDto.endLatitude,
          ratio,
        ),
        longitude: this.interpolateCoordinate(
          createPackageDto.startLongitude,
          createPackageDto.endLongitude,
          ratio,
        ),
        width: defaults.width,
        height: defaults.height,
        type: defaults.type,
        direction: createPackageDto.direction,
        hasLighting: defaults.hasLighting ?? false,
        lightingPrice: defaults.lightingPrice,
        price: defaults.price ?? pricingData.localPrice,
        ...pricingData,
        pricingUnit: defaults.pricingUnit ?? 'MONTH',
        currency: defaults.currency ?? 'USD',
        taxRatePercent: defaults.taxRatePercent ?? 0,
        displayDurationSeconds: defaults.displayDurationSeconds,
        status,
        isPackageOnly: true,
      };
    });
  }

  private interpolateCoordinate(start: number, end: number, ratio: number) {
    return start + (end - start) * ratio;
  }

  private ensureDistinctPackageCoordinates(
    createPackageDto: CreateRoadBillboardPackageDto,
  ): void {
    if (
      createPackageDto.startLatitude === createPackageDto.endLatitude &&
      createPackageDto.startLongitude === createPackageDto.endLongitude
    ) {
      throw new BadRequestException(
        'Package start and end coordinates cannot be identical',
      );
    }
  }

  private ensureBillboardBusinessRules(billboard: {
    type: BillboardType;
    printedSubtype?: unknown;
    pricingUnit?: PricingUnit;
    displayDurationSeconds?: number;
    localFlexPrice?: number;
    internationalFlexPrice?: number;
    localStandardAddedValue?: number;
    internationalStandardAddedValue?: number;
  }): void {
    if (
      billboard.printedSubtype !== undefined &&
      billboard.type !== BillboardType.PRINTED
    ) {
      throw new BadRequestException(
        'printedSubtype is only valid for PRINTED billboards',
      );
    }

    if (
      billboard.pricingUnit === PricingUnit.HOUR &&
      billboard.type !== BillboardType.CAR_AD
    ) {
      throw new BadRequestException(
        'pricingUnit HOUR is only valid for CAR_AD billboards',
      );
    }

    if (
      billboard.displayDurationSeconds !== undefined &&
      billboard.type !== BillboardType.DIGITAL
    ) {
      throw new BadRequestException(
        'displayDurationSeconds is only valid for DIGITAL billboards',
      );
    }

    const hasPrintedComponent =
      billboard.localFlexPrice !== undefined ||
      billboard.internationalFlexPrice !== undefined ||
      billboard.localStandardAddedValue !== undefined ||
      billboard.internationalStandardAddedValue !== undefined;

    if (hasPrintedComponent && billboard.type !== BillboardType.PRINTED) {
      throw new BadRequestException(
        'Printed pricing components are only valid for PRINTED billboards',
      );
    }
  }

  private computeBillboardScopedPrices(billboard: {
    type: BillboardType;
    printedSubtype?: PrintedSubtype | null;
    localPrice?: number;
    internationalPrice?: number;
    localFlexPrice?: number;
    internationalFlexPrice?: number;
    localStandardAddedValue?: number;
    internationalStandardAddedValue?: number;
  }): {
    printedSubtype: PrintedSubtype | null;
    localPrice: number;
    internationalPrice: number;
    localFlexPrice: number | null;
    internationalFlexPrice: number | null;
    localStandardAddedValue: number | null;
    internationalStandardAddedValue: number | null;
  } {
    if (billboard.type !== BillboardType.PRINTED) {
      if (
        billboard.localPrice === undefined ||
        billboard.internationalPrice === undefined
      ) {
        throw new BadRequestException(
          'localPrice and internationalPrice are required for non-PRINTED billboards',
        );
      }

      return {
        printedSubtype: null,
        localPrice: billboard.localPrice,
        internationalPrice: billboard.internationalPrice,
        localFlexPrice: null,
        internationalFlexPrice: null,
        localStandardAddedValue: null,
        internationalStandardAddedValue: null,
      };
    }

    const printedSubtype =
      billboard.printedSubtype ?? PrintedSubtype.FLEX;

    if (
      billboard.localFlexPrice === undefined ||
      billboard.internationalFlexPrice === undefined
    ) {
      throw new BadRequestException(
        'localFlexPrice and internationalFlexPrice are required for PRINTED billboards',
      );
    }

    const localStandardAddedValue =
      billboard.localStandardAddedValue ?? 0;
    const internationalStandardAddedValue =
      billboard.internationalStandardAddedValue ?? 0;

    if (
      printedSubtype === PrintedSubtype.STANDARD &&
      (billboard.localStandardAddedValue === undefined ||
        billboard.internationalStandardAddedValue === undefined)
    ) {
      throw new BadRequestException(
        'localStandardAddedValue and internationalStandardAddedValue are required for STANDARD printed billboards',
      );
    }

    return {
      printedSubtype,
      localPrice:
        printedSubtype === PrintedSubtype.STANDARD
          ? billboard.localFlexPrice + localStandardAddedValue
          : billboard.localFlexPrice,
      internationalPrice:
        printedSubtype === PrintedSubtype.STANDARD
          ? billboard.internationalFlexPrice + internationalStandardAddedValue
          : billboard.internationalFlexPrice,
      localFlexPrice: billboard.localFlexPrice,
      internationalFlexPrice: billboard.internationalFlexPrice,
      localStandardAddedValue,
      internationalStandardAddedValue,
    };
  }

  private ensureRoadPackageBillboardDefaults(
    createPackageDto: CreateRoadBillboardPackageDto,
  ): void {
    const defaults = createPackageDto.billboardDefaults;

    if (
      defaults.printedSubtype !== undefined &&
      defaults.type !== BillboardType.PRINTED
    ) {
      throw new BadRequestException(
        'printedSubtype is only valid for PRINTED billboards',
      );
    }

    if (
      defaults.pricingUnit === PricingUnit.HOUR &&
      defaults.type !== BillboardType.CAR_AD
    ) {
      throw new BadRequestException(
        'pricingUnit HOUR is only valid for CAR_AD billboards',
      );
    }

    if (
      defaults.displayDurationSeconds !== undefined &&
      defaults.type !== BillboardType.DIGITAL
    ) {
      throw new BadRequestException(
        'displayDurationSeconds is only valid for DIGITAL billboards',
      );
    }
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

  private async paginateBookingItems(args: {
    page: number;
    limit: number;
    where: Prisma.BookingRequestItemWhereInput;
    include?: Prisma.BookingRequestItemInclude;
    orderBy?: Prisma.BookingRequestItemOrderByWithRelationInput;
  }) {
    const skip = (args.page - 1) * args.limit;
    const [data, total] = await Promise.all([
      this.billboardsRepository.findBookingItems({
        where: args.where,
        include: args.include,
        orderBy: args.orderBy,
        skip,
        take: args.limit,
      }),
      this.billboardsRepository.countBookingItems(args.where),
    ]);
    const totalPages = Math.ceil(total / args.limit);

    return {
      data: data.map((item) => this.withBookingItemMainImages(item)),
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

  private async resolveBookingItems(
    items: CreateBookingItemDto[],
    customerCompanyScope: CustomerCompanyScope,
  ): Promise<ResolvedBookingItem[]> {
    const billboardIds = items
      .filter((item) => item.itemType === BookingItemType.BILLBOARD)
      .map((item) => item.billboardId)
      .filter((id): id is string => Boolean(id));
    const roadPackageIds = items
      .filter((item) => item.itemType === BookingItemType.ROAD_PACKAGE)
      .map((item) => item.roadPackageId)
      .filter((id): id is string => Boolean(id));
    const offerIds = items
      .filter((item) => item.itemType === BookingItemType.OFFER)
      .map((item) => item.offerId)
      .filter((id): id is string => Boolean(id));
    const now = new Date();
    const [billboards, roadPackages, offers] = await Promise.all([
      this.billboardsRepository.findPublicBillboardsForBooking(billboardIds),
      this.billboardsRepository.findPublicRoadPackagesForBooking(roadPackageIds),
      this.billboardsRepository.findPublicOffersForBooking(offerIds, now),
    ]);
    const billboardMap = new Map(billboards.map((billboard) => [billboard.id, billboard]));
    const packageMap = new Map(roadPackages.map((roadPackage) => [roadPackage.id, roadPackage]));
    const offerMap = new Map(offers.map((offer) => [offer.id, offer]));

    return items.map((item) => {
      if (item.itemType === BookingItemType.BILLBOARD) {
        if (!item.billboardId) {
          throw new BadRequestException('billboardId is required for BILLBOARD items');
        }

        const billboard = billboardMap.get(item.billboardId);

        if (!billboard) {
          throw new NotFoundException('Billboard is not available for booking');
        }

        return this.resolveBillboardBookingItem(
          item,
          billboard,
          customerCompanyScope,
        );
      }

      if (item.itemType === BookingItemType.ROAD_PACKAGE) {
        if (!item.roadPackageId) {
          throw new BadRequestException(
            'roadPackageId is required for ROAD_PACKAGE items',
          );
        }

        const roadPackage = packageMap.get(item.roadPackageId);

        if (!roadPackage || roadPackage.billboards.length === 0) {
          throw new NotFoundException(
            'Road package is not available for booking',
          );
        }

        return this.resolveGroupedBookingItem(
          item,
          roadPackage.companyId,
          roadPackage.billboards,
          customerCompanyScope,
        );
      }

      if (!item.offerId) {
        throw new BadRequestException('offerId is required for OFFER items');
      }

      const offer = offerMap.get(item.offerId);

      if (!offer || offer.items.length === 0) {
        throw new NotFoundException('Offer is not available for booking');
      }

      return this.resolveOfferBookingItem(item, offer, customerCompanyScope);
    });
  }

  private resolveBillboardBookingItem(
    item: CreateBookingItemDto,
    billboard: BookingBillboardSnapshot,
    customerCompanyScope: CustomerCompanyScope,
  ): ResolvedBookingItem {
    const price = this.resolveBillboardPrice(billboard, customerCompanyScope);
    const taxRatePercent = Number(billboard.taxRatePercent);
    const taxAmount = this.calculateTax(price, taxRatePercent);

    return {
      input: item,
      companyId: billboard.companyId,
      billboardIds: [billboard.id],
      priceSnapshot: price,
      selectedCustomerCompanyScope: customerCompanyScope,
      localPriceSnapshot: Number(billboard.localPrice),
      internationalPriceSnapshot: Number(billboard.internationalPrice),
      pricingUnit: billboard.pricingUnit,
      currency: billboard.currency,
      taxRatePercent,
      taxAmount,
      totalBeforeTax: price,
      totalAfterTax: price + taxAmount,
    };
  }

  private resolveGroupedBookingItem(
    item: CreateBookingItemDto,
    companyId: string,
    billboards: BookingBillboardSnapshot[],
    customerCompanyScope: CustomerCompanyScope,
  ): ResolvedBookingItem {
    const firstBillboard = billboards[0];
    let totalBeforeTax = 0;
    let taxAmount = 0;
    let localPriceSnapshot = 0;
    let internationalPriceSnapshot = 0;

    for (const billboard of billboards) {
      const price = this.resolveBillboardPrice(billboard, customerCompanyScope);
      localPriceSnapshot += Number(billboard.localPrice);
      internationalPriceSnapshot += Number(billboard.internationalPrice);
      totalBeforeTax += price;
      taxAmount += this.calculateTax(price, Number(billboard.taxRatePercent));
    }

    return {
      input: item,
      companyId,
      billboardIds: billboards.map((billboard) => billboard.id),
      priceSnapshot: totalBeforeTax,
      selectedCustomerCompanyScope: customerCompanyScope,
      localPriceSnapshot,
      internationalPriceSnapshot,
      pricingUnit: firstBillboard.pricingUnit,
      currency: firstBillboard.currency,
      taxRatePercent: 0,
      taxAmount,
      totalBeforeTax,
      totalAfterTax: totalBeforeTax + taxAmount,
    };
  }

  private resolveOfferBookingItem(
    item: CreateBookingItemDto,
    offer: {
      companyId: string;
      originalTotalPrice: Prisma.Decimal;
      discountedTotalPrice: Prisma.Decimal;
      localOriginalTotalPrice: Prisma.Decimal;
      internationalOriginalTotalPrice: Prisma.Decimal;
      localDiscountedTotalPrice: Prisma.Decimal;
      internationalDiscountedTotalPrice: Prisma.Decimal;
      currency: string;
      items: { billboard: BookingBillboardSnapshot; priceSnapshot: Prisma.Decimal | null }[];
    },
    customerCompanyScope: CustomerCompanyScope,
  ): ResolvedBookingItem {
    const originalTotalPrice =
      customerCompanyScope === CustomerCompanyScope.LOCAL
        ? Number(offer.localOriginalTotalPrice)
        : Number(offer.internationalOriginalTotalPrice);
    const discountedTotalPrice =
      customerCompanyScope === CustomerCompanyScope.LOCAL
        ? Number(offer.localDiscountedTotalPrice)
        : Number(offer.internationalDiscountedTotalPrice);
    const discountRatio =
      originalTotalPrice > 0 ? discountedTotalPrice / originalTotalPrice : 0;
    let taxAmount = 0;
    let localPriceSnapshot = 0;
    let internationalPriceSnapshot = 0;

    for (const item of offer.items) {
      const price = this.resolveBillboardPrice(item.billboard, customerCompanyScope);
      localPriceSnapshot += Number(item.billboard.localPrice);
      internationalPriceSnapshot += Number(item.billboard.internationalPrice);
      taxAmount += this.calculateTax(
        price * discountRatio,
        Number(item.billboard.taxRatePercent),
      );
    }

    return {
      input: item,
      companyId: offer.companyId,
      billboardIds: offer.items.map((offerItem) => offerItem.billboard.id),
      priceSnapshot: discountedTotalPrice,
      selectedCustomerCompanyScope: customerCompanyScope,
      localPriceSnapshot,
      internationalPriceSnapshot,
      pricingUnit: PricingUnit.CUSTOM,
      currency: offer.currency,
      taxRatePercent: 0,
      taxAmount,
      totalBeforeTax: discountedTotalPrice,
      totalAfterTax: discountedTotalPrice + taxAmount,
      totalBeforeDiscount: originalTotalPrice,
      totalAfterDiscount: discountedTotalPrice,
      discountAmount: originalTotalPrice - discountedTotalPrice,
    };
  }

  private async findAvailabilityConflictsForResolvedItems(
    items: ResolvedBookingItem[],
    excludeBookingItemId?: string,
  ): Promise<AvailabilityConflict[]> {
    const billboardIds = Array.from(
      new Set(items.flatMap((item) => item.billboardIds)),
    );

    if (billboardIds.length === 0) {
      return [];
    }

    const minStartDate = this.minDate(items.map((item) => item.input.startDate));
    const maxEndDate = this.maxDate(items.map((item) => item.input.endDate));
    const [unavailablePeriods, approvedItems] = await Promise.all([
      this.billboardsRepository.findBulkOverlappingUnavailablePeriods(
        billboardIds,
        minStartDate,
        maxEndDate,
      ),
      this.billboardsRepository.findBulkOverlappingApprovedBookingItems(
        billboardIds,
        minStartDate,
        maxEndDate,
        excludeBookingItemId,
      ),
    ]);
    const unavailableByBillboard = new Map<string, typeof unavailablePeriods>();

    for (const period of unavailablePeriods) {
      const periods = unavailableByBillboard.get(period.billboardId) ?? [];
      periods.push(period);
      unavailableByBillboard.set(period.billboardId, periods);
    }

    const approvedConflicts = approvedItems.flatMap((bookingItem) => {
      const occupiedBillboardIds = new Set<string>();

      if (bookingItem.billboardId) {
        occupiedBillboardIds.add(bookingItem.billboardId);
      }

      bookingItem.roadPackage?.billboards.forEach((billboard) =>
        occupiedBillboardIds.add(billboard.id),
      );
      bookingItem.offer?.items.forEach((offerItem) =>
        occupiedBillboardIds.add(offerItem.billboardId),
      );

      return Array.from(occupiedBillboardIds).map((billboardId) => ({
        billboardId,
        bookingItem,
      }));
    });
    const conflicts: AvailabilityConflict[] = [];

    items.forEach((item, requestedItemIndex) => {
      for (const billboardId of item.billboardIds) {
        for (const period of unavailableByBillboard.get(billboardId) ?? []) {
          if (this.rangesOverlap(item.input.startDate, item.input.endDate, period.startDate, period.endDate)) {
            conflicts.push({
              requestedItemIndex,
              billboardId,
              type: 'UNAVAILABLE_PERIOD',
              startDate: period.startDate,
              endDate: period.endDate,
            });
          }
        }

        for (const conflict of approvedConflicts) {
          if (
            conflict.billboardId === billboardId &&
            this.rangesOverlap(
              item.input.startDate,
              item.input.endDate,
              conflict.bookingItem.startDate,
              conflict.bookingItem.endDate,
            )
          ) {
            conflicts.push({
              requestedItemIndex,
              billboardId,
              type: 'APPROVED_BOOKING_ITEM',
              startDate: conflict.bookingItem.startDate,
              endDate: conflict.bookingItem.endDate,
              bookingRequestItemId: conflict.bookingItem.id,
            });
          }
        }
      }
    });

    return conflicts;
  }

  private async filterAvailableBillboardIds(
    billboardIds: string[],
    startDate: Date,
    endDate: Date,
  ) {
    if (billboardIds.length === 0) {
      return [];
    }

    const [unavailablePeriods, approvedItems] = await Promise.all([
      this.billboardsRepository.findBulkOverlappingUnavailablePeriods(
        billboardIds,
        startDate,
        endDate,
      ),
      this.billboardsRepository.findBulkOverlappingApprovedBookingItems(
        billboardIds,
        startDate,
        endDate,
      ),
    ]);
    const unavailableIds = new Set(
      unavailablePeriods.map((period) => period.billboardId),
    );

    for (const item of approvedItems) {
      if (item.billboardId) {
        unavailableIds.add(item.billboardId);
      }

      item.roadPackage?.billboards.forEach((billboard) =>
        unavailableIds.add(billboard.id),
      );
      item.offer?.items.forEach((offerItem) =>
        unavailableIds.add(offerItem.billboardId),
      );
    }

    return billboardIds.filter((billboardId) => !unavailableIds.has(billboardId));
  }

  private calculateBookingTotals(items: ResolvedBookingItem[]) {
    return {
      subtotalBeforeTax: items.reduce((total, item) => total + item.totalBeforeTax, 0),
      totalTaxAmount: items.reduce((total, item) => total + item.taxAmount, 0),
      totalAfterTax: items.reduce((total, item) => total + item.totalAfterTax, 0),
      totalBeforeDiscount: items.reduce(
        (total, item) => total + (item.totalBeforeDiscount ?? item.totalBeforeTax),
        0,
      ),
      totalAfterDiscount: items.reduce(
        (total, item) => total + (item.totalAfterDiscount ?? item.totalBeforeTax),
        0,
      ),
    };
  }

  private toBookingRequestItemCreateInput(
    item: ResolvedBookingItem,
  ): Prisma.BookingRequestItemUncheckedCreateWithoutBookingRequestInput {
    return {
      billboardId: item.input.billboardId,
      roadPackageId: item.input.roadPackageId,
      offerId: item.input.offerId,
      companyId: item.companyId,
      itemType: item.input.itemType,
      startDate: item.input.startDate,
      endDate: item.input.endDate,
      status: BookingRequestItemStatus.PENDING,
      priceSnapshot: item.priceSnapshot,
      pricingUnit: item.pricingUnit,
      currency: item.currency,
      taxRatePercent: item.taxRatePercent,
      taxAmount: item.taxAmount,
      totalBeforeTax: item.totalBeforeTax,
      totalAfterTax: item.totalAfterTax,
      discountAmount: item.discountAmount,
      selectedCustomerCompanyScope: item.selectedCustomerCompanyScope,
      localPriceSnapshot: item.localPriceSnapshot,
      internationalPriceSnapshot: item.internationalPriceSnapshot,
    };
  }

  private async resolveExistingBookingItemForAvailability(item: {
    itemType: BookingItemType;
    billboardId?: string | null;
    roadPackageId?: string | null;
    offerId?: string | null;
    startDate: Date;
    endDate: Date;
    selectedCustomerCompanyScope?: CustomerCompanyScope | null;
  }) {
    const [resolvedItem] = await this.resolveBookingItems([
      {
        itemType: item.itemType,
        billboardId: item.billboardId ?? undefined,
        roadPackageId: item.roadPackageId ?? undefined,
        offerId: item.offerId ?? undefined,
        startDate: item.startDate,
        endDate: item.endDate,
      },
    ], item.selectedCustomerCompanyScope ?? CustomerCompanyScope.LOCAL);

    return resolvedItem;
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

  private withOfferDiscountAmount<T extends Record<string, unknown>>(
    offer: T,
  ) {
    return {
      ...offer,
      discountAmount:
        Number(offer.originalTotalPrice) - Number(offer.discountedTotalPrice),
      localDiscountAmount:
        Number(offer.localOriginalTotalPrice ?? offer.originalTotalPrice) -
        Number(offer.localDiscountedTotalPrice ?? offer.discountedTotalPrice),
      internationalDiscountAmount:
        Number(
          offer.internationalOriginalTotalPrice ?? offer.originalTotalPrice,
        ) -
        Number(
          offer.internationalDiscountedTotalPrice ??
            offer.discountedTotalPrice,
        ),
    };
  }

  private toPublicOffer(offer: {
    items?: {
      billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  }) {
    const offerWithDiscount = this.withOfferDiscountAmount(offer);

    return {
      ...offerWithDiscount,
      items: (offer.items ?? []).map((item) => ({
        ...item,
        billboard: item.billboard
          ? this.toPublicBillboard(item.billboard)
          : item.billboard,
      })),
    };
  }

  private withBookingBillboardMainImage(bookingRequest: {
    billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
    items?: {
      billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
      [key: string]: unknown;
    }[];
    creatives?: {
      billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  }) {
    return {
      ...bookingRequest,
      billboard: bookingRequest.billboard
        ? this.toPublicBillboard(bookingRequest.billboard)
        : bookingRequest.billboard,
      items: bookingRequest.items?.map((item) =>
        this.withBookingItemMainImages(item),
      ),
      creatives: bookingRequest.creatives?.map((creative) => ({
        ...creative,
        billboard: creative.billboard
          ? this.toPublicBillboard(creative.billboard)
          : creative.billboard,
      })),
    };
  }

  private withBookingItemMainImages<T extends {
    billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
    roadPackage?: {
      billboards?: { media?: { isMain: boolean }[]; [key: string]: unknown }[];
      [key: string]: unknown;
    } | null;
    offer?: {
      items?: {
        billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
        [key: string]: unknown;
      }[];
      [key: string]: unknown;
    } | null;
    creatives?: {
      billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
      [key: string]: unknown;
    }[];
    bookingRequest?: {
      creatives?: {
        billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
        [key: string]: unknown;
      }[];
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  }>(item: T) {
    return {
      ...item,
      billboard: item.billboard
        ? this.toPublicBillboard(item.billboard)
        : item.billboard,
      roadPackage: item.roadPackage
        ? {
            ...item.roadPackage,
            billboards: item.roadPackage.billboards?.map((billboard) =>
              this.toPublicBillboard(billboard),
            ),
          }
        : item.roadPackage,
      offer: item.offer ? this.toPublicOffer(item.offer) : item.offer,
      creatives: item.creatives?.map((creative) => ({
        ...creative,
        billboard: creative.billboard
          ? this.toPublicBillboard(creative.billboard)
          : creative.billboard,
      })),
      bookingRequest: item.bookingRequest
        ? {
            ...item.bookingRequest,
            creatives: item.bookingRequest.creatives?.map((creative) => ({
              ...creative,
              billboard: creative.billboard
                ? this.toPublicBillboard(creative.billboard)
                : creative.billboard,
            })),
          }
        : item.bookingRequest,
    };
  }

  private withInstallationUnitMainImage<T extends {
    billboard?: { media?: { isMain: boolean }[]; [key: string]: unknown } | null;
    [key: string]: unknown;
  }>(unit: T) {
    return {
      ...unit,
      billboard: unit.billboard
        ? this.toPublicBillboard(unit.billboard)
        : unit.billboard,
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

  private rangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date,
  ): boolean {
    return startA < endB && endA > startB;
  }

  private minDate(dates: Date[]): Date {
    return new Date(Math.min(...dates.map((date) => date.getTime())));
  }

  private maxDate(dates: Date[]): Date {
    return new Date(Math.max(...dates.map((date) => date.getTime())));
  }

  private resolveBillboardPrice(
    billboard: BookingBillboardSnapshot,
    customerCompanyScope: CustomerCompanyScope,
  ): number {
    if (customerCompanyScope === CustomerCompanyScope.LOCAL) {
      return Number(billboard.localPrice);
    }

    if (customerCompanyScope === CustomerCompanyScope.INTERNATIONAL) {
      return Number(billboard.internationalPrice);
    }

    throw new BadRequestException('customerCompanyScope is required for pricing');
  }

  private calculateTax(amount: number, taxRatePercent: number): number {
    return amount * (taxRatePercent / 100);
  }

  private async syncBookingRequestStatus(bookingRequestId: string) {
    const items =
      await this.billboardsRepository.listBookingItemStatuses(bookingRequestId);
    const statuses = items.map((item) => item.status);
    const all = (status: BookingRequestItemStatus) =>
      statuses.length > 0 && statuses.every((itemStatus) => itemStatus === status);
    const has = (status: BookingRequestItemStatus) => statuses.includes(status);
    let status: BookingRequestStatus = BookingRequestStatus.PENDING_REVIEW;

    if (all(BookingRequestItemStatus.APPROVED)) {
      status = BookingRequestStatus.APPROVED;
    } else if (all(BookingRequestItemStatus.REJECTED)) {
      status = BookingRequestStatus.REJECTED;
    } else if (all(BookingRequestItemStatus.CANCELLED)) {
      status = BookingRequestStatus.CANCELLED;
    } else if (
      has(BookingRequestItemStatus.APPROVED) &&
      has(BookingRequestItemStatus.REJECTED)
    ) {
      status = BookingRequestStatus.PARTIALLY_REJECTED;
    } else if (
      has(BookingRequestItemStatus.APPROVED) &&
      has(BookingRequestItemStatus.PENDING)
    ) {
      status = BookingRequestStatus.PARTIALLY_APPROVED;
    }

    await this.billboardsRepository.updateBookingRequest(bookingRequestId, {
      status,
    });

    if (status === BookingRequestStatus.APPROVED) {
      await this.notifyBookingFullyApproved(bookingRequestId);
    }

    return status;
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

  private notifyRoadPackageSubmitted(roadPackageId: string) {
    return this.notificationsService.create({
      role: UserRole.SUPER_ADMIN,
      type: NotificationType.BILLBOARD_SUBMITTED,
      title: 'Road billboard package submitted for approval',
      message: 'A road billboard package was submitted for approval.',
      entityType: 'ROAD_BILLBOARD_PACKAGE',
      entityId: roadPackageId,
    });
  }

  private notifyOfferSubmitted(offerId: string) {
    return this.notificationsService.create({
      role: UserRole.SUPER_ADMIN,
      type: NotificationType.BILLBOARD_SUBMITTED,
      title: 'Billboard offer submitted for approval',
      message: 'A billboard offer was submitted for approval.',
      entityType: 'OFFER',
      entityId: offerId,
    });
  }

  private async notifyBookingCreated(
    bookingRequestId: string,
    items: ResolvedBookingItem[],
  ) {
    const companyIds = Array.from(new Set(items.map((item) => item.companyId)));

    await Promise.all([
      ...companyIds.map((companyId) =>
        this.notificationsService.create({
          companyId,
          type: NotificationType.BOOKING_REQUEST_CREATED,
          title: 'New booking item',
          message: 'A customer created a booking that includes your company.',
          entityType: 'BOOKING_REQUEST',
          entityId: bookingRequestId,
        }),
      ),
      this.notificationsService.create({
        role: UserRole.SUPER_ADMIN,
        type: NotificationType.BOOKING_REQUEST_CREATED,
        title: 'New booking request',
        message: 'A customer created a new multi-item booking request.',
        entityType: 'BOOKING_REQUEST',
        entityId: bookingRequestId,
      }),
    ]);
  }

  private async notifyBookingItemStatusChanged(
    bookingRequestId: string,
    bookingRequestItemId: string,
  ) {
    const bookingRequest =
      await this.billboardsRepository.findBookingRequestDetailById(
        bookingRequestId,
      );

    if (!bookingRequest) {
      return;
    }

    await this.notificationsService.create({
      userId: bookingRequest.customerId,
      type: NotificationType.BOOKING_REQUEST_STATUS_CHANGED,
      title: 'Booking item status updated',
      message: 'A partner updated one of your booking items.',
      entityType: 'BOOKING_REQUEST_ITEM',
      entityId: bookingRequestItemId,
    });
  }

  private async notifyBookingFullyApproved(bookingRequestId: string) {
    const bookingRequest =
      await this.billboardsRepository.findBookingRequestDetailById(
        bookingRequestId,
      );

    if (!bookingRequest) {
      return;
    }

    await this.notificationsService.create({
      userId: bookingRequest.customerId,
      type: NotificationType.BOOKING_REQUEST_STATUS_CHANGED,
      title: 'Booking request approved',
      message: 'All items in your booking request were approved.',
      entityType: 'BOOKING_REQUEST',
      entityId: bookingRequestId,
    });
  }
}
