import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const httpsEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.HTTPS_ENABLED ?? 'false').toLowerCase(),
  );
  const httpsCertDir = process.env.HTTPS_CERT_DIR ?? '/certs/backend';
  const httpsCertFile = process.env.HTTPS_CERT_FILE ?? 'cert.pem';
  const httpsKeyFile = process.env.HTTPS_KEY_FILE ?? 'key.pem';

  const httpsOptions = httpsEnabled
    ? {
        httpsOptions: {
          cert: fs.readFileSync(path.join(httpsCertDir, httpsCertFile)),
          key: fs.readFileSync(path.join(httpsCertDir, httpsKeyFile)),
        },
      }
    : undefined;

  const app = await NestFactory.create(AppModule, httpsOptions);

  // Increase payload size limit to 50 MB (default is 100 KB)
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ limit: '3mb', extended: true }));

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token', 'x-database-id'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`data-vault backend listening on ${httpsEnabled ? 'https' : 'http'}://0.0.0.0:${port}`);
}

bootstrap();

