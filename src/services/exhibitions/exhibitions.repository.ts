import { Injectable } from '@nestjs/common';
import {
  Exhibition,
  ExhibitionBookingItemStatus,
  ExhibitionBookingRequestStatus,
  ExhibitionBoothStatus,
  Prisma,
  ServiceSubscriptionStatus,
  ServiceType,
} from '@prisma/client';
import { BaseRepository } from '../../shared/database/repositories/base.repository';
import { PrismaService } from '../../shared/database/prisma/prisma.service';

export interface ExhibitionContentInput {
  aboutCards?: Prisma.ExhibitionAboutCardCreateManyExhibitionInput[];
  sectors?: Prisma.ExhibitionSectorCreateManyExhibitionInput[];
  participationFeatures?: Prisma.ExhibitionParticipationFeatureCreateManyExhibitionInput[];
}

@Injectable()
export class ExhibitionsRepository extends BaseRepository<Exhibition> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.exhibition);
  }

  createExhibition(
    data: Prisma.ExhibitionUncheckedCreateInput,
    content: ExhibitionContentInput,
  ) {
    return this.prisma.exhibition.create({
      data: {
        ...data,
        aboutCards: content.aboutCards?.length
          ? { createMany: { data: content.aboutCards } }
          : undefined,
        sectors: content.sectors?.length
          ? { createMany: { data: content.sectors } }
          : undefined,
        participationFeatures: content.participationFeatures?.length
          ? { createMany: { data: content.participationFeatures } }
          : undefined,
      },
      include: this.detailInclude(),
    });
  }

  findById(id: string) {
    return this.prisma.exhibition.findFirst({
      where: { id, deletedAt: null },
      include: this.detailInclude(),
    });
  }

  findCompanyExhibition(id: string, companyId: string) {
    return this.prisma.exhibition.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.detailInclude(),
    });
  }

  findBySlug(slug: string, where: Prisma.ExhibitionWhereInput) {
    return this.prisma.exhibition.findFirst({
      where: { slug, ...where },
      select: this.publicDetailSelect(),
    });
  }

  findSlug(slug: string) {
    return this.prisma.exhibition.findUnique({
      where: { slug },
      select: { id: true },
    });
  }

  findActiveExhibitionsSubscription(companyId: string) {
    return this.prisma.companyServiceSubscription.findFirst({
      where: {
        companyId,
        serviceType: ServiceType.EXHIBITIONS,
        status: ServiceSubscriptionStatus.ACTIVE,
        company: { deletedAt: null },
      },
    });
  }

  updateExhibition(
    id: string,
    data: Prisma.ExhibitionUpdateInput,
    content?: ExhibitionContentInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.exhibition.update({
        where: { id },
        data,
      });

      if (content?.aboutCards) {
        await tx.exhibitionAboutCard.deleteMany({ where: { exhibitionId: id } });
        if (content.aboutCards.length > 0) {
          await tx.exhibitionAboutCard.createMany({
            data: content.aboutCards.map((item) => ({
              ...item,
              exhibitionId: id,
            })),
          });
        }
      }

      if (content?.sectors) {
        await tx.exhibitionSector.deleteMany({ where: { exhibitionId: id } });
        if (content.sectors.length > 0) {
          await tx.exhibitionSector.createMany({
            data: content.sectors.map((item) => ({
              ...item,
              exhibitionId: id,
            })),
          });
        }
      }

      if (content?.participationFeatures) {
        await tx.exhibitionParticipationFeature.deleteMany({
          where: { exhibitionId: id },
        });
        if (content.participationFeatures.length > 0) {
          await tx.exhibitionParticipationFeature.createMany({
            data: content.participationFeatures.map((item) => ({
              ...item,
              exhibitionId: id,
            })),
          });
        }
      }

      return tx.exhibition.findUniqueOrThrow({
        where: { id },
        include: this.detailInclude(),
      });
    });
  }

  softDeleteExhibition(id: string, deletedAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.exhibitionBooth.updateMany({
        where: { exhibitionId: id, deletedAt: null },
        data: { deletedAt },
      });
      await tx.exhibition.update({
        where: { id },
        data: { deletedAt },
      });

      return tx.exhibition.findUniqueOrThrow({
        where: { id },
        include: this.detailInclude(),
      });
    });
  }

  createBooth(data: Prisma.ExhibitionBoothUncheckedCreateInput) {
    return this.prisma.exhibitionBooth.create({
      data,
      include: this.boothInclude(),
    });
  }

  findBooths(args: Prisma.ExhibitionBoothFindManyArgs) {
    return this.prisma.exhibitionBooth.findMany(args);
  }

  countBooths(where: Prisma.ExhibitionBoothWhereInput) {
    return this.prisma.exhibitionBooth.count({ where });
  }

  findBoothById(boothId: string, exhibitionId: string) {
    return this.prisma.exhibitionBooth.findFirst({
      where: { id: boothId, exhibitionId, deletedAt: null },
      include: this.boothInclude(),
    });
  }

  updateBooth(id: string, data: Prisma.ExhibitionBoothUncheckedUpdateInput) {
    return this.prisma.exhibitionBooth.update({
      where: { id },
      data,
      include: this.boothInclude(),
    });
  }

  findActiveBoothsByCodes(exhibitionId: string, codes: string[]) {
    return this.prisma.exhibitionBooth.findMany({
      where: {
        exhibitionId,
        code: { in: codes },
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
      },
    });
  }

  findActiveBoothsByIds(exhibitionId: string, boothIds: string[]) {
    return this.prisma.exhibitionBooth.findMany({
      where: {
        exhibitionId,
        id: { in: boothIds },
        deletedAt: null,
      },
      include: this.boothInclude(),
    });
  }

  createBoothsBulk(data: Prisma.ExhibitionBoothUncheckedCreateInput[]) {
    return this.prisma.$transaction((tx) =>
      Promise.all(
        data.map((booth) =>
          tx.exhibitionBooth.create({
            data: booth,
            include: this.boothInclude(),
          }),
        ),
      ),
    );
  }

  updateBoothsBulk(
    updates: {
      id: string;
      data: Prisma.ExhibitionBoothUncheckedUpdateInput;
    }[],
  ) {
    return this.prisma.$transaction((tx) =>
      Promise.all(
        updates.map((update) =>
          tx.exhibitionBooth.update({
            where: { id: update.id },
            data: update.data,
            include: this.boothInclude(),
          }),
        ),
      ),
    );
  }

  softDeleteBoothsBulk(ids: string[], deletedAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.exhibitionBooth.updateMany({
        where: {
          id: { in: ids },
          deletedAt: null,
        },
        data: { deletedAt },
      });

      return result.count;
    });
  }

  findSectorById(sectorId: string, exhibitionId: string) {
    return this.prisma.exhibitionSector.findFirst({
      where: {
        id: sectorId,
        exhibitionId,
      },
      select: {
        id: true,
      },
    });
  }

  findPublicBookableExhibition(id: string) {
    return this.prisma.exhibition.findFirst({
      where: {
        id,
        status: 'APPROVED',
        deletedAt: null,
        company: this.publicVisibleCompanyWhere(),
      },
      include: {
        booths: {
          where: { deletedAt: null },
        },
      },
    });
  }

  createBookingRequestWithItems(args: {
    data: Prisma.ExhibitionBookingRequestUncheckedCreateInput;
    items: Prisma.ExhibitionBookingItemUncheckedCreateWithoutBookingRequestInput[];
  }) {
    return this.prisma.exhibitionBookingRequest.create({
      data: {
        ...args.data,
        items: {
          create: args.items,
        },
      },
      include: this.bookingDetailInclude(),
    });
  }

  findBookingRequestById(id: string) {
    return this.prisma.exhibitionBookingRequest.findFirst({
      where: { id, deletedAt: null },
      include: this.bookingDetailInclude(),
    });
  }

  findCustomerBookingRequest(id: string, customerId: string) {
    return this.prisma.exhibitionBookingRequest.findFirst({
      where: { id, customerId, deletedAt: null },
      include: this.bookingDetailInclude(),
    });
  }

  findBookingRequests(args: Prisma.ExhibitionBookingRequestFindManyArgs) {
    return this.prisma.exhibitionBookingRequest.findMany(args);
  }

  countBookingRequests(where: Prisma.ExhibitionBookingRequestWhereInput) {
    return this.prisma.exhibitionBookingRequest.count({ where });
  }

  findBookingItems(args: Prisma.ExhibitionBookingItemFindManyArgs) {
    return this.prisma.exhibitionBookingItem.findMany(args);
  }

  countBookingItems(where: Prisma.ExhibitionBookingItemWhereInput) {
    return this.prisma.exhibitionBookingItem.count({ where });
  }

  findPartnerBookingItem(id: string, companyId: string) {
    return this.prisma.exhibitionBookingItem.findFirst({
      where: {
        id,
        bookingRequest: {
          companyId,
          deletedAt: null,
        },
      },
      include: this.partnerBookingItemInclude(),
    });
  }

  findPartnerBookingItemPublic(id: string, companyId: string) {
    return this.prisma.exhibitionBookingItem.findFirst({
      where: {
        id,
        bookingRequest: {
          companyId,
          deletedAt: null,
        },
      },
      select: this.partnerBookingItemSelect(),
    });
  }

  listBookingItemStatuses(bookingRequestId: string) {
    return this.prisma.exhibitionBookingItem.findMany({
      where: { bookingRequestId },
      select: { status: true },
    });
  }

  updateBookingRequestStatus(
    id: string,
    status: ExhibitionBookingRequestStatus,
  ) {
    return this.prisma.exhibitionBookingRequest.update({
      where: { id },
      data: { status },
      include: this.bookingDetailInclude(),
    });
  }

  cancelPendingBookingItems(bookingRequestId: string) {
    return this.prisma.exhibitionBookingItem.updateMany({
      where: {
        bookingRequestId,
        status: ExhibitionBookingItemStatus.PENDING,
      },
      data: {
        status: ExhibitionBookingItemStatus.CANCELLED,
      },
    });
  }

  approveBookingItem(itemId: string, boothId: string, approvedAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const boothUpdate = await tx.exhibitionBooth.updateMany({
        where: {
          id: boothId,
          status: ExhibitionBoothStatus.AVAILABLE,
          deletedAt: null,
        },
        data: {
          status: ExhibitionBoothStatus.BOOKED,
        },
      });

      if (boothUpdate.count !== 1) {
        return null;
      }

      return tx.exhibitionBookingItem.update({
        where: { id: itemId },
        data: {
          status: ExhibitionBookingItemStatus.APPROVED,
          approvedAt,
          rejectedAt: null,
        },
        select: this.partnerBookingItemSelect(),
      });
    });
  }

  rejectBookingItem(
    itemId: string,
    partnerNotes: string | undefined,
    rejectedAt: Date,
  ) {
    return this.prisma.exhibitionBookingItem.update({
      where: { id: itemId },
      data: {
        status: ExhibitionBookingItemStatus.REJECTED,
        partnerNotes,
        rejectedAt,
        approvedAt: null,
      },
      select: this.partnerBookingItemSelect(),
    });
  }

  countActiveBooths(exhibitionId: string) {
    return this.prisma.exhibitionBooth.count({
      where: { exhibitionId, deletedAt: null },
    });
  }

  listActiveBoothsForValidation(exhibitionId: string) {
    return this.prisma.exhibitionBooth.findMany({
      where: { exhibitionId, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        price: true,
        localPrice: true,
        internationalPrice: true,
        setupPrice: true,
        coordinates: true,
      },
    });
  }

  listInclude() {
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
          aboutCards: true,
          sectors: true,
          participationFeatures: true,
          booths: { where: { deletedAt: null } },
        },
      },
    } satisfies Prisma.ExhibitionInclude;
  }

  detailInclude() {
    return {
      company: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      aboutCards: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      sectors: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      participationFeatures: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      booths: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: this.boothInclude(),
      },
      _count: {
        select: {
          aboutCards: true,
          sectors: true,
          participationFeatures: true,
          booths: { where: { deletedAt: null } },
        },
      },
    } satisfies Prisma.ExhibitionInclude;
  }

  publicListSelect() {
    return {
      id: true,
      title: true,
      subtitle: true,
      slug: true,
      description: true,
      heroImageUrl: true,
      secondaryHeroImageUrl: true,
      visitorCount: true,
      participantCount: true,
      participationDays: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      country: true,
      province: true,
      city: true,
      addressText: true,
      mapImageUrl: true,
      approvedAt: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          booths: { where: { deletedAt: null } },
        },
      },
    } satisfies Prisma.ExhibitionSelect;
  }

  publicDetailSelect() {
    return {
      ...this.publicListSelect(),
      mapPdfUrl: true,
      aboutCards: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      sectors: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      participationFeatures: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      booths: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          price: true,
          localPrice: true,
          internationalPrice: true,
          setupPrice: true,
          currency: true,
          status: true,
          shape: true,
          coordinates: true,
          color: true,
          area: true,
          sector: {
            select: {
              id: true,
              title: true,
            },
          },
          sortOrder: true,
        },
      },
    } satisfies Prisma.ExhibitionSelect;
  }

  bookingDetailInclude() {
    return {
      exhibition: {
        select: {
          id: true,
          title: true,
          slug: true,
          city: true,
          venueName: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          booth: {
            select: this.bookingBoothSelect(),
          },
        },
      },
    } satisfies Prisma.ExhibitionBookingRequestInclude;
  }

  partnerBookingItemInclude() {
    return {
      bookingRequest: {
        include: {
          exhibition: {
            select: {
              id: true,
              title: true,
              slug: true,
              city: true,
              venueName: true,
            },
          },
        },
      },
      booth: {
        select: this.bookingBoothSelect(),
      },
    } satisfies Prisma.ExhibitionBookingItemInclude;
  }

  partnerBookingItemSelect() {
    return {
      id: true,
      status: true,
      priceSnapshot: true,
      localPriceSnapshot: true,
      internationalPriceSnapshot: true,
      setupPriceSnapshot: true,
      currency: true,
      partnerNotes: true,
      approvedAt: true,
      rejectedAt: true,
      createdAt: true,
      updatedAt: true,
      booth: {
        select: this.bookingBoothSelect(),
      },
      bookingRequest: {
        select: {
          id: true,
          status: true,
          customerFullName: true,
          customerCompany: true,
          customerNotes: true,
          customerCompanyScope: true,
          customerSector: true,
          createdAt: true,
          exhibition: {
            select: {
              id: true,
              title: true,
              slug: true,
              city: true,
              venueName: true,
            },
          },
        },
      },
    } satisfies Prisma.ExhibitionBookingItemSelect;
  }

  private bookingBoothSelect() {
    return {
      id: true,
      code: true,
      title: true,
      description: true,
      price: true,
      localPrice: true,
      internationalPrice: true,
      setupPrice: true,
      currency: true,
      status: true,
      shape: true,
      coordinates: true,
      color: true,
      area: true,
      sector: {
        select: {
          id: true,
          title: true,
        },
      },
    } satisfies Prisma.ExhibitionBoothSelect;
  }

  private boothInclude() {
    return {
      sector: {
        select: {
          id: true,
          title: true,
        },
      },
    } satisfies Prisma.ExhibitionBoothInclude;
  }

  private publicVisibleCompanyWhere() {
    return {
      status: 'ACTIVE',
      deletedAt: null,
      serviceSubscriptions: {
        some: {
          serviceType: ServiceType.EXHIBITIONS,
          status: ServiceSubscriptionStatus.ACTIVE,
        },
      },
    } satisfies Prisma.CompanyWhereInput;
  }
}
