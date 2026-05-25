import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';

process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/sila_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-minimum-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-minimum-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';

import { AppModule } from './../src/app.module';
import { PaginationDto } from './../src/shared/common/dto/pagination.dto';
import { PaginationMeta } from './../src/shared/common/types/pagination-meta.type';
import { PrismaService } from './../src/shared/database/prisma/prisma.service';
import { HttpExceptionFilter } from './../src/shared/common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './../src/shared/common/interceptors/api-response.interceptor';
import { LoggingInterceptor } from './../src/shared/common/interceptors/logging.interceptor';

@Controller('test-pagination')
class TestPaginationController {
  @Get()
  findAll(@Query() query: PaginationDto) {
    const meta: PaginationMeta = {
      page: query.page,
      limit: query.limit,
      total: 42,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: query.page > 1,
    };

    return {
      data: [{ id: 'test-item' }],
      meta,
    };
  }
}

describe('API response contract (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestPaginationController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix(
      moduleFixture.get(ConfigService).getOrThrow<string>('apiPrefix'),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new ApiResponseInterceptor(),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          success: true,
          statusCode: 200,
          message: 'Success',
          data: {
            status: 'ok',
            service: 'sila-api',
            timestamp: expect.any(String),
          },
        });
        expect(new Date(response.body.data.timestamp).toISOString()).toBe(
          response.body.data.timestamp,
        );
      });
  });

  it('/api/v1/not-found (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/not-found')
      .expect(404)
      .expect((response) => {
        expect(response.body).toEqual({
          success: false,
          statusCode: 404,
          message: 'Cannot GET /api/v1/not-found',
          errors: {
            message: 'Cannot GET /api/v1/not-found',
            error: 'Not Found',
            statusCode: 404,
          },
        });
      });
  });

  it('/api/v1/test-pagination (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/test-pagination?page=2&limit=20')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          success: true,
          statusCode: 200,
          message: 'Success',
          data: [{ id: 'test-item' }],
          meta: {
            page: 2,
            limit: 20,
            total: 42,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true,
          },
        });
      });
  });

  it('/api/v1/test-pagination (GET) validates query params', () => {
    return request(app.getHttpServer())
      .get('/api/v1/test-pagination?page=0&limit=101&extra=value')
      .expect(400)
      .expect((response) => {
        expect(response.body).toEqual({
          success: false,
          statusCode: 400,
          message: expect.any(String),
          errors: expect.arrayContaining([
            'property extra should not exist',
            'page must not be less than 1',
            'limit must not be greater than 100',
          ]),
        });
      });
  });

  afterEach(async () => {
    await app?.close();
  });
});
