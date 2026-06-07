import { Injectable } from '@nestjs/common';
import {
  Billboard,
  BillboardMedia,
  BookingRequest,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
} from '@prisma/client';
import { BaseRepository } from '../../shared/database/repositories/base.repository';
import { PrismaService } from '../../shared/database/prisma/prisma.service';

@Injectable()
export class BillboardsRepository extends BaseRepository<Billboard> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.billboard);
  }

  createBillboard(data: Prisma.BillboardCreateInput) {
    return this.prisma.billboard.create({
      data,
      include: this.defaultInclude(),
    });
  }

  createRoadPackageWithBillboards(args: {
    packageData: Prisma.RoadBillboardPackageUncheckedCreateInput;
    billboards: Prisma.BillboardUncheckedCreateInput[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const roadPackage = await tx.roadBillboardPackage.create({
        data: args.packageData,
      });

      await tx.billboard.createMany({
        data: args.billboards.map((billboard) => ({
          ...billboard,
          roadPackageId: roadPackage.id,
        })),
      });

      return tx.roadBillboardPackage.findUniqueOrThrow({
        where: { id: roadPackage.id },
        include: this.roadPackageDetailInclude(),
      });
    });
  }

  findCompanyBillboardsForOffer(companyId: string, billboardIds: string[]) {
    return this.prisma.billboard.findMany({
      where: {
        id: { in: billboardIds },
        companyId,
        deletedAt: null,
        status: { not: 'ARCHIVED' },
      },
      select: {
        id: true,
        price: true,
        localPrice: true,
        internationalPrice: true,
        status: true,
      },
    });
  }

  createOfferWithItems(args: {
    offerData: Prisma.OfferUncheckedCreateInput;
    items: Prisma.OfferItemUncheckedCreateWithoutOfferInput[];
  }) {
    return this.prisma.offer.create({
      data: {
        ...args.offerData,
        items: {
          create: args.items,
        },
      },
      include: this.offerDetailInclude(),
    });
  }

  findById(id: string) {
    return this.prisma.billboard.findFirst({
      where: { id, deletedAt: null },
      include: this.defaultInclude(),
    });
  }

  findPublicById(id: string, where: Prisma.BillboardWhereInput) {
    return this.prisma.billboard.findFirst({
      where: { id, ...where },
      select: this.publicSelect(),
    });
  }

  findPublicMany(
    where: Prisma.BillboardWhereInput,
    take: number,
    orderBy: Prisma.BillboardOrderByWithRelationInput[],
  ) {
    return this.prisma.billboard.findMany({
      where,
      take,
      orderBy,
      select: this.publicSelect(),
    });
  }

  findPublicBillboards(args: Prisma.BillboardFindManyArgs) {
    return this.prisma.billboard.findMany(args);
  }

  findPublicBillboardsForBooking(billboardIds: string[]) {
    return this.prisma.billboard.findMany({
      where: {
        id: { in: billboardIds },
        status: 'APPROVED',
        deletedAt: null,
        company: this.bookableCompanyWhere(),
      },
      select: this.bookingBillboardInputSelect(),
    });
  }

  findPublicRoadPackagesForBooking(roadPackageIds: string[]) {
    return this.prisma.roadBillboardPackage.findMany({
      where: {
        id: { in: roadPackageIds },
        status: 'APPROVED',
        deletedAt: null,
        company: this.bookableCompanyWhere(),
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        billboards: {
          where: {
            status: 'APPROVED',
            deletedAt: null,
          },
          select: this.bookingBillboardInputSelect(),
        },
      },
    });
  }

  findPublicOffersForBooking(offerIds: string[], now: Date) {
    return this.prisma.offer.findMany({
      where: {
        id: { in: offerIds },
        status: 'APPROVED',
        deletedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
        company: this.bookableCompanyWhere(),
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            billboard: {
              select: this.bookingBillboardInputSelect(),
            },
          },
        },
      },
    });
  }

  findCompanyBillboard(id: string, companyId: string) {
    return this.prisma.billboard.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.defaultInclude(),
    });
  }

  updateBillboard(id: string, data: Prisma.BillboardUpdateInput) {
    return this.prisma.billboard.update({
      where: { id },
      data,
      include: this.defaultInclude(),
    });
  }

  findActiveBillboardsSubscription(companyId: string) {
    return this.prisma.companyServiceSubscription.findFirst({
      where: {
        companyId,
        serviceType: ServiceType.BILLBOARDS,
        status: ServiceSubscriptionStatus.ACTIVE,
        company: { deletedAt: null },
      },
    });
  }

  findRoadPackages(args: Prisma.RoadBillboardPackageFindManyArgs) {
    return this.prisma.roadBillboardPackage.findMany(args);
  }

  countRoadPackages(where: Prisma.RoadBillboardPackageWhereInput) {
    return this.prisma.roadBillboardPackage.count({ where });
  }

  findRoadPackageById(id: string) {
    return this.prisma.roadBillboardPackage.findFirst({
      where: { id, deletedAt: null },
      include: this.roadPackageDetailInclude(),
    });
  }

  findCompanyRoadPackage(id: string, companyId: string) {
    return this.prisma.roadBillboardPackage.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.roadPackageDetailInclude(),
    });
  }

  updateRoadPackageAndMaybeBillboards(
    id: string,
    data: Prisma.RoadBillboardPackageUpdateInput,
    billboardData?: Prisma.BillboardUpdateManyMutationInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const roadPackage = await tx.roadBillboardPackage.update({
        where: { id },
        data,
      });

      if (billboardData && Object.keys(billboardData).length > 0) {
        await tx.billboard.updateMany({
          where: { roadPackageId: id, deletedAt: null },
          data: billboardData,
        });
      }

      return tx.roadBillboardPackage.findUniqueOrThrow({
        where: { id: roadPackage.id },
        include: this.roadPackageDetailInclude(),
      });
    });
  }

  softDeleteRoadPackage(id: string, deletedAt: Date) {
    return this.updateRoadPackageAndMaybeBillboards(
      id,
      { deletedAt },
      { deletedAt },
    );
  }

  findOffers(args: Prisma.OfferFindManyArgs) {
    return this.prisma.offer.findMany(args);
  }

  countOffers(where: Prisma.OfferWhereInput) {
    return this.prisma.offer.count({ where });
  }

  findOfferById(id: string) {
    return this.prisma.offer.findFirst({
      where: { id, deletedAt: null },
      include: this.offerDetailInclude(),
    });
  }

  findCompanyOffer(id: string, companyId: string) {
    return this.prisma.offer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.offerDetailInclude(),
    });
  }

  findPublicOfferById(id: string, where: Prisma.OfferWhereInput) {
    return this.prisma.offer.findFirst({
      where: { id, ...where },
      include: this.publicOfferDetailInclude(),
    });
  }

  updateOffer(
    id: string,
    data: Prisma.OfferUpdateInput,
    items?: Prisma.OfferItemUncheckedCreateWithoutOfferInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id },
        data,
      });

      if (items) {
        await tx.offerItem.deleteMany({
          where: { offerId: id },
        });

        await tx.offerItem.createMany({
          data: items.map((item) => ({
            ...item,
            offerId: id,
          })),
        });
      }

      return tx.offer.findUniqueOrThrow({
        where: { id },
        include: this.offerDetailInclude(),
      });
    });
  }

  softDeleteOffer(id: string, deletedAt: Date) {
    return this.updateOffer(id, { deletedAt });
  }

  listMedia(billboardId: string) {
    return this.prisma.billboardMedia.findMany({
      where: { billboardId },
      orderBy: this.mediaOrderBy(),
    });
  }

  createUnavailablePeriod(
    data: Prisma.BillboardUnavailablePeriodUncheckedCreateInput,
  ) {
    return this.prisma.billboardUnavailablePeriod.create({ data });
  }

  listUnavailablePeriods(billboardId: string) {
    return this.prisma.billboardUnavailablePeriod.findMany({
      where: { billboardId },
      orderBy: { startDate: 'asc' },
    });
  }

  findUnavailablePeriodById(periodId: string, billboardId: string) {
    return this.prisma.billboardUnavailablePeriod.findFirst({
      where: { id: periodId, billboardId },
    });
  }

  updateUnavailablePeriod(
    periodId: string,
    data: Prisma.BillboardUnavailablePeriodUpdateInput,
  ) {
    return this.prisma.billboardUnavailablePeriod.update({
      where: { id: periodId },
      data,
    });
  }

  deleteUnavailablePeriod(periodId: string) {
    return this.prisma.billboardUnavailablePeriod.delete({
      where: { id: periodId },
    });
  }

  findOverlappingUnavailablePeriods(
    billboardId: string,
    startDate: Date,
    endDate: Date,
    excludePeriodId?: string,
  ) {
    return this.prisma.billboardUnavailablePeriod.findMany({
      where: {
        billboardId,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        ...(excludePeriodId ? { id: { not: excludePeriodId } } : {}),
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findOverlappingApprovedBookings(
    billboardId: string,
    startDate: Date,
    endDate: Date,
    excludeBookingRequestId?: string,
  ) {
    return this.prisma.bookingRequest.findMany({
      where: {
        billboardId,
        status: 'APPROVED',
        deletedAt: null,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        ...(excludeBookingRequestId
          ? { id: { not: excludeBookingRequestId } }
          : {}),
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findBulkOverlappingUnavailablePeriods(
    billboardIds: string[],
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.billboardUnavailablePeriod.findMany({
      where: {
        billboardId: { in: billboardIds },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findBulkOverlappingApprovedBookingItems(
    billboardIds: string[],
    startDate: Date,
    endDate: Date,
    excludeBookingItemId?: string,
  ) {
    return this.prisma.bookingRequestItem.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        ...(excludeBookingItemId ? { id: { not: excludeBookingItemId } } : {}),
        OR: [
          { billboardId: { in: billboardIds } },
          {
            roadPackage: {
              billboards: {
                some: {
                  id: { in: billboardIds },
                },
              },
            },
          },
          {
            offer: {
              items: {
                some: {
                  billboardId: { in: billboardIds },
                },
              },
            },
          },
        ],
      },
      include: {
        roadPackage: {
          select: {
            billboards: {
              select: { id: true },
            },
          },
        },
        offer: {
          select: {
            items: {
              select: { billboardId: true },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  createBookingRequest(data: Prisma.BookingRequestUncheckedCreateInput) {
    return this.prisma.bookingRequest.create({
      data,
      include: this.customerBookingInclude(),
    });
  }

  createBookingRequestWithItems(
    data: Prisma.BookingRequestUncheckedCreateInput,
    items: Prisma.BookingRequestItemUncheckedCreateWithoutBookingRequestInput[],
  ) {
    return this.prisma.bookingRequest.create({
      data: {
        ...data,
        items: {
          create: items,
        },
      },
      include: this.bookingRequestDetailInclude(),
    });
  }

  findBookingRequestById(id: string) {
    return this.prisma.bookingRequest.findFirst({
      where: { id, deletedAt: null },
      include: this.bookingRequestDetailInclude(),
    });
  }

  findCustomerBookingRequest(id: string, customerId: string) {
    return this.prisma.bookingRequest.findFirst({
      where: { id, customerId, deletedAt: null },
      include: this.bookingRequestDetailInclude(),
    });
  }

  updateBookingRequest(id: string, data: Prisma.BookingRequestUpdateInput) {
    return this.prisma.bookingRequest.update({
      where: { id },
      data,
      include: this.bookingRequestDetailInclude(),
    });
  }

  findBookingRequestDetailById(id: string) {
    return this.prisma.bookingRequest.findFirst({
      where: { id, deletedAt: null },
      include: this.bookingRequestDetailInclude(),
    });
  }

  findBookingRequests(
    args: Prisma.BookingRequestFindManyArgs,
  ): Promise<BookingRequest[]> {
    return this.prisma.bookingRequest.findMany(args);
  }

  countBookingRequests(
    where: Prisma.BookingRequestWhereInput,
  ): Promise<number> {
    return this.prisma.bookingRequest.count({ where });
  }

  findBookingItems(args: Prisma.BookingRequestItemFindManyArgs) {
    return this.prisma.bookingRequestItem.findMany(args);
  }

  countBookingItems(where: Prisma.BookingRequestItemWhereInput) {
    return this.prisma.bookingRequestItem.count({ where });
  }

  findPartnerBookingItem(id: string, companyId: string) {
    return this.prisma.bookingRequestItem.findFirst({
      where: { id, companyId },
      include: this.partnerBookingItemInclude(),
    });
  }

  updateBookingItem(
    id: string,
    data: Prisma.BookingRequestItemUpdateInput,
  ) {
    return this.prisma.bookingRequestItem.update({
      where: { id },
      data,
      include: this.partnerBookingItemInclude(),
    });
  }

  listBookingItemStatuses(bookingRequestId: string) {
    return this.prisma.bookingRequestItem.findMany({
      where: { bookingRequestId },
      select: { status: true },
    });
  }

  findMediaById(mediaId: string, billboardId: string) {
    return this.prisma.billboardMedia.findFirst({
      where: { id: mediaId, billboardId },
    });
  }

  async addMedia(
    billboardId: string,
    data: Prisma.BillboardMediaUncheckedCreateInput,
    shouldUnsetOtherMainImages: boolean,
  ): Promise<BillboardMedia> {
    return this.prisma.$transaction(async (tx) => {
      if (shouldUnsetOtherMainImages) {
        await tx.billboardMedia.updateMany({
          where: { billboardId },
          data: { isMain: false },
        });
      }

      return tx.billboardMedia.create({ data });
    });
  }

  async updateMedia(
    mediaId: string,
    billboardId: string,
    data: Prisma.BillboardMediaUpdateInput,
    shouldUnsetOtherMainImages: boolean,
  ): Promise<BillboardMedia> {
    return this.prisma.$transaction(async (tx) => {
      if (shouldUnsetOtherMainImages) {
        await tx.billboardMedia.updateMany({
          where: {
            billboardId,
            id: { not: mediaId },
          },
          data: { isMain: false },
        });
      }

      return tx.billboardMedia.update({
        where: { id: mediaId },
        data,
      });
    });
  }

  async deleteMedia(mediaId: string, billboardId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const media = await tx.billboardMedia.delete({
        where: { id: mediaId },
      });

      if (!media.isMain) {
        return;
      }

      const nextMedia = await tx.billboardMedia.findFirst({
        where: { billboardId },
        orderBy: [{ createdAt: 'asc' }],
      });

      if (nextMedia) {
        await tx.billboardMedia.update({
          where: { id: nextMedia.id },
          data: { isMain: true },
        });
      }
    });
  }

  defaultInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      media: {
        orderBy: this.mediaOrderBy(),
      },
    } satisfies Prisma.BillboardInclude;
  }

  mediaOrderBy() {
    return [
      { isMain: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ] satisfies Prisma.BillboardMediaOrderByWithRelationInput[];
  }

  publicSelect() {
    return {
      id: true,
      roadPackageId: true,
      title: true,
      description: true,
      country: true,
      province: true,
      city: true,
      addressText: true,
      latitude: true,
      longitude: true,
      width: true,
      height: true,
      type: true,
      direction: true,
      printedSubtype: true,
      hasLighting: true,
      lightingPrice: true,
      price: true,
      localPrice: true,
      internationalPrice: true,
      pricingUnit: true,
      currency: true,
      taxRatePercent: true,
      displayDurationSeconds: true,
      isPackageOnly: true,
      status: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      media: {
        orderBy: this.mediaOrderBy(),
      },
    } satisfies Prisma.BillboardSelect;
  }

  customerBookingInclude() {
    return {
      billboard: {
        select: this.bookingBillboardSelect(),
      },
    } satisfies Prisma.BookingRequestInclude;
  }

  adminBookingInclude() {
    return {
      billboard: {
        select: {
          ...this.bookingBillboardSelect(),
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    } satisfies Prisma.BookingRequestInclude;
  }

  bookingRequestDetailInclude() {
    return {
      billboard: {
        select: this.bookingBillboardSelect(),
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: this.bookingItemDetailInclude(),
      },
    } satisfies Prisma.BookingRequestInclude;
  }

  partnerBookingSelect() {
    return {
      id: true,
      billboard: {
        select: this.bookingBillboardSelect(),
      },
      startDate: true,
      endDate: true,
      status: true,
      estimatedPrice: true,
      pricingUnit: true,
      currency: true,
      createdAt: true,
    } satisfies Prisma.BookingRequestSelect;
  }

  partnerBookingItemInclude() {
    return {
      bookingRequest: {
        select: {
          id: true,
          customerFullName: true,
          customerCompany: true,
          customerCompanyScope: true,
          customerSector: true,
          customerNotes: true,
          status: true,
          createdAt: true,
        },
      },
      billboard: {
        select: this.bookingBillboardSelect(),
      },
      roadPackage: {
        select: {
          id: true,
          title: true,
          direction: true,
          billboardsCount: true,
          status: true,
        },
      },
      offer: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          originalTotalPrice: true,
          discountedTotalPrice: true,
          localOriginalTotalPrice: true,
          internationalOriginalTotalPrice: true,
          localDiscountedTotalPrice: true,
          internationalDiscountedTotalPrice: true,
          currency: true,
          status: true,
        },
      },
    } satisfies Prisma.BookingRequestItemInclude;
  }

  bookingItemDetailInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      billboard: {
        select: this.bookingBillboardSelect(),
      },
      roadPackage: {
        select: {
          id: true,
          title: true,
          direction: true,
          billboardsCount: true,
          status: true,
        },
      },
      offer: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          originalTotalPrice: true,
          discountedTotalPrice: true,
          localOriginalTotalPrice: true,
          internationalOriginalTotalPrice: true,
          localDiscountedTotalPrice: true,
          internationalDiscountedTotalPrice: true,
          currency: true,
          status: true,
        },
      },
    } satisfies Prisma.BookingRequestItemInclude;
  }

  private bookingBillboardSelect() {
    return {
      id: true,
      title: true,
      city: true,
      country: true,
      province: true,
      type: true,
      price: true,
      localPrice: true,
      internationalPrice: true,
      pricingUnit: true,
      currency: true,
      media: {
        orderBy: this.mediaOrderBy(),
      },
    } satisfies Prisma.BillboardSelect;
  }

  private bookingBillboardInputSelect() {
    return {
      id: true,
      companyId: true,
      price: true,
      localPrice: true,
      internationalPrice: true,
      pricingUnit: true,
      currency: true,
      taxRatePercent: true,
      title: true,
    } satisfies Prisma.BillboardSelect;
  }

  private bookableCompanyWhere() {
    return {
      status: 'ACTIVE',
      deletedAt: null,
      serviceSubscriptions: {
        some: {
          serviceType: ServiceType.BILLBOARDS,
          status: ServiceSubscriptionStatus.ACTIVE,
        },
      },
    } satisfies Prisma.CompanyWhereInput;
  }

  roadPackageListInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      _count: {
        select: {
          billboards: true,
        },
      },
    } satisfies Prisma.RoadBillboardPackageInclude;
  }

  roadPackageDetailInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      billboards: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: this.defaultInclude(),
      },
      _count: {
        select: {
          billboards: true,
        },
      },
    } satisfies Prisma.RoadBillboardPackageInclude;
  }

  offerListInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    } satisfies Prisma.OfferInclude;
  }

  offerDetailInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          billboard: {
            select: this.offerBillboardSelect(),
          },
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    } satisfies Prisma.OfferInclude;
  }

  publicOfferListInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          billboard: {
            select: this.publicSelect(),
          },
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    } satisfies Prisma.OfferInclude;
  }

  publicOfferDetailInclude() {
    return this.publicOfferListInclude();
  }

  private offerBillboardSelect() {
    return {
      id: true,
      title: true,
      country: true,
      province: true,
      city: true,
      type: true,
      direction: true,
      price: true,
      localPrice: true,
      internationalPrice: true,
      pricingUnit: true,
      currency: true,
      status: true,
      media: {
        orderBy: this.mediaOrderBy(),
      },
    } satisfies Prisma.BillboardSelect;
  }
}
