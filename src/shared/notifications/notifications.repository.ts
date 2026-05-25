import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { BaseRepository } from '../database/repositories/base.repository';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class NotificationsRepository extends BaseRepository<Notification> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.notification);
  }

  createNotification(data: Prisma.NotificationCreateInput) {
    return this.prisma.notification.create({ data });
  }

  findVisibleById(id: string, where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.findFirst({
      where: {
        id,
        ...where,
      },
    });
  }

  markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markManyAsRead(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.updateMany({
      where: {
        ...where,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }
}
