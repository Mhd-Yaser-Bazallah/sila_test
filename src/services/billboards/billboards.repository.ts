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

  createBookingRequest(data: Prisma.BookingRequestUncheckedCreateInput) {
    return this.prisma.bookingRequest.create({
      data,
      include: this.customerBookingInclude(),
    });
  }

  findBookingRequestById(id: string) {
    return this.prisma.bookingRequest.findFirst({
      where: { id, deletedAt: null },
      include: this.adminBookingInclude(),
    });
  }

  findCustomerBookingRequest(id: string, customerId: string) {
    return this.prisma.bookingRequest.findFirst({
      where: { id, customerId, deletedAt: null },
      include: this.customerBookingInclude(),
    });
  }

  updateBookingRequest(id: string, data: Prisma.BookingRequestUpdateInput) {
    return this.prisma.bookingRequest.update({
      where: { id },
      data,
      include: this.adminBookingInclude(),
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
      hasLighting: true,
      price: true,
      pricingUnit: true,
      currency: true,
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

  private bookingBillboardSelect() {
    return {
      id: true,
      title: true,
      city: true,
      country: true,
      province: true,
      type: true,
      price: true,
      pricingUnit: true,
      currency: true,
      media: {
        orderBy: this.mediaOrderBy(),
      },
    } satisfies Prisma.BillboardSelect;
  }
}
