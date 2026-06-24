import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PrismaService } from '../database/prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.validateCredentials(loginDto);
    const tokens = await this.createTokens(user);

    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  async registerCustomer(registerCustomerDto: RegisterCustomerDto) {
    const email = registerCustomerDto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new ConflictException('User email already exists');
    }

    const passwordHash = await bcrypt.hash(
      registerCustomerDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    const createdUser = await this.prisma.user.create({
      data: {
        fullName: registerCustomerDto.fullName,
        email,
        phone: registerCustomerDto.phone,
        passwordHash,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        companyId: null,
      },
    });
    const user = this.toAuthenticatedUser(createdUser);
    const tokens = await this.createTokens(user);

    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    const user = await this.findActiveUser(payload.sub);

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const safeUser = this.toAuthenticatedUser(user);
    const tokens = await this.createTokens(safeUser);

    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: safeUser,
    };
  }

  async logout(user: AuthenticatedUser) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    });

    return { message: 'Logged out successfully' };
  }

  async getMe(user: AuthenticatedUser): Promise<AuthenticatedUser> {
    const activeUser = await this.findActiveUser(user.id);

    if (!activeUser) {
      throw new UnauthorizedException('Invalid access token');
    }

    return this.toAuthenticatedUser(activeUser);
  }

  private async validateCredentials(
    loginDto: LoginDto,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email.toLowerCase(),
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            status: true,
            serviceSubscriptions: {
              select: {
                serviceType: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.toAuthenticatedUser(user);
  }

  private async findActiveUser(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            status: true,
            serviceSubscriptions: {
              select: {
                serviceType: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  private async createTokens(user: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwtAccessSecret'),
        expiresIn: this.getJwtExpiresIn('jwtAccessExpiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwtRefreshSecret'),
        expiresIn: this.getJwtExpiresIn('jwtRefreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('jwtRefreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async storeRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: AuthenticatedUser['role'];
    status: string;
    companyId: string | null;
    company?: {
      id: string;
      name: string;
      logoUrl: string | null;
      status: string;
      serviceSubscriptions?: {
        serviceType: string;
        status: string;
      }[];
    } | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            logoUrl: user.company.logoUrl,
            status: user.company.status,
            serviceSubscriptions: user.company.serviceSubscriptions?.map(
              (subscription) => ({
                serviceType: subscription.serviceType,
                status: subscription.status,
              }),
            ),
          }
        : null,
    };
  }

  private getJwtExpiresIn(configKey: string): JwtSignOptions['expiresIn'] {
    return this.configService.getOrThrow<string>(
      configKey,
    ) as JwtSignOptions['expiresIn'];
  }
}
