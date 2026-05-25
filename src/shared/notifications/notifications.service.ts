import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationsRepository } from './notifications.repository';

interface CreateNotificationInput {
  userId?: string;
  companyId?: string;
  role?: UserRole;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  create(input: CreateNotificationInput) {
    return this.notificationsRepository.createNotification({
      user: input.userId ? { connect: { id: input.userId } } : undefined,
      company: input.companyId
        ? { connect: { id: input.companyId } }
        : undefined,
      role: input.role,
      title: input.title,
      message: input.message,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  findVisible(user: AuthenticatedUser, query: QueryNotificationsDto) {
    return this.notificationsRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: {
        ...this.buildVisibleWhere(user),
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(user: AuthenticatedUser, id: string) {
    const notification = await this.notificationsRepository.findVisibleById(
      id,
      this.buildVisibleWhere(user),
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.notificationsRepository.markAsRead(id);
  }

  async markAllAsRead(user: AuthenticatedUser) {
    return this.notificationsRepository.markManyAsRead(
      this.buildVisibleWhere(user),
    );
  }

  private buildVisibleWhere(
    user: AuthenticatedUser,
  ): Prisma.NotificationWhereInput {
    if (user.role === UserRole.COMPANY_ADMIN) {
      return {
        OR: [
          { userId: user.id },
          ...(user.companyId ? [{ companyId: user.companyId }] : []),
          { role: UserRole.COMPANY_ADMIN, companyId: null },
        ],
      };
    }

    return {
      OR: [{ userId: user.id }, { role: user.role }],
    };
  }
}
