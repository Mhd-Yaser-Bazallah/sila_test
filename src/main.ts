import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './shared/common/interceptors/api-response.interceptor';
import { LoggingInterceptor } from './shared/common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const configService = app.get(ConfigService);
  const apiPrefix = configService.getOrThrow<string>('apiPrefix');
  const corsOrigin = configService.getOrThrow<string>('corsOrigin');
  const port = configService.getOrThrow<number>('port');
  const uploadRoot = configService.getOrThrow<string>('uploadRoot');
  const maxUploadSizeMb = configService.getOrThrow<number>('maxUploadSizeMb');
  const uploadRootPath = resolve(process.cwd(), uploadRoot);

  mkdirSync(join(uploadRootPath, 'billboards'), { recursive: true });
  mkdirSync(join(uploadRootPath, 'billboards', 'creatives'), {
    recursive: true,
  });
  mkdirSync(join(uploadRootPath, 'billboards', 'installations'), {
    recursive: true,
  });
  mkdirSync(join(uploadRootPath, 'business-proofs'), { recursive: true });
  mkdirSync(join(uploadRootPath, 'companies', 'logos'), { recursive: true });
  mkdirSync(join(uploadRootPath, 'exhibitions', 'maps'), { recursive: true });
  mkdirSync(join(uploadRootPath, 'exhibitions', 'heroes'), { recursive: true });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: maxUploadSizeMb * 1024 * 1024,
    },
  });
  await app.register(fastifyStatic, {
    root: uploadRootPath,
    prefix: `/${uploadRoot}/`,
  });

  app.setGlobalPrefix(apiPrefix);
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
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
}
bootstrap();
