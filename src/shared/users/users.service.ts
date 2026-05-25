import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../auth/constants/auth.constants';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UnauthorizedException } from '@nestjs/common';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { ChangeUserPasswordDto } from './dto/change-user-password.dto';
import { CreateCompanyAdminUserDto } from './dto/create-company-admin-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createCompanyAdmin(createUserDto: CreateCompanyAdminUserDto) {
    const company = await this.usersRepository.findCompanyById(
      createUserDto.companyId,
    );

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const email = this.normalizeEmail(createUserDto.email);
    await this.ensureEmailIsAvailable(email);

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    return this.usersRepository.createUser({
      company: { connect: { id: createUserDto.companyId } },
      fullName: createUserDto.fullName,
      email,
      phone: createUserDto.phone,
      passwordHash,
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
    });
  }

  findAll(query: QueryUsersDto) {
    return this.usersRepository.paginate({
      page: query.page,
      limit: query.limit,
      where: this.buildWhere(query),
      select: this.usersRepository.safeSelect(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const email = updateUserDto.email
      ? this.normalizeEmail(updateUserDto.email)
      : undefined;

    if (email) {
      await this.ensureEmailIsAvailable(email, id);
    }

    return this.usersRepository.updateUser(id, {
      fullName: updateUserDto.fullName,
      phone: updateUserDto.phone,
      status: updateUserDto.status,
      ...(updateUserDto.email !== undefined ? { email } : {}),
    });
  }

  async changePassword(
    id: string,
    changeUserPasswordDto: ChangeUserPasswordDto,
  ) {
    await this.findOne(id);

    const passwordHash = await bcrypt.hash(
      changeUserPasswordDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    return this.usersRepository.updateUser(id, {
      passwordHash,
      refreshTokenHash: null,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.usersRepository.updateUser(id, {
      deletedAt: new Date(),
      refreshTokenHash: null,
    });
  }

  findMe(user: AuthenticatedUser) {
    return this.findOne(user.id);
  }

  async updateMe(
    user: AuthenticatedUser,
    updateMyProfileDto: UpdateMyProfileDto,
  ) {
    await this.findOne(user.id);

    return this.usersRepository.updateUser(user.id, {
      fullName: updateMyProfileDto.fullName,
      phone: updateMyProfileDto.phone,
    });
  }

  async changeMyPassword(
    user: AuthenticatedUser,
    changeMyPasswordDto: ChangeMyPasswordDto,
  ) {
    const existingUser = await this.usersRepository.findByIdWithPassword(
      user.id,
    );

    if (!existingUser?.passwordHash) {
      throw new UnauthorizedException('Invalid current password');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changeMyPasswordDto.currentPassword,
      existingUser.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const passwordHash = await bcrypt.hash(
      changeMyPasswordDto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    return this.usersRepository.updateUser(user.id, {
      passwordHash,
      refreshTokenHash: null,
    });
  }

  private async ensureEmailIsAvailable(
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const existingUser = await this.usersRepository.findActiveByEmail(
      email,
      excludeId,
    );

    if (existingUser) {
      throw new ConflictException('User email already exists');
    }
  }

  private buildWhere(query: QueryUsersDto): Prisma.UserWhereInput {
    return {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
