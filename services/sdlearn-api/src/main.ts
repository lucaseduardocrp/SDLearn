import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './errors/app-exception.filter';
import { loadConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const envFile = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(existsSync);
  if (envFile) process.loadEnvFile(envFile);
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '2mb' });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();

  // Serve the built web app from the same process when it exists (single-container deployments).
  const webDist = [process.env.WEB_DIST_DIR, resolve(__dirname, '../../../../sdlearn-web/dist')].find((dir): dir is string => Boolean(dir && existsSync(resolve(dir, 'index.html'))));
  if (webDist) {
    app.useStaticAssets(webDist, { index: false });
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (request.method !== 'GET' || request.path.startsWith('/api') || !request.accepts('html')) return next();
      response.sendFile(resolve(webDist, 'index.html'));
    });
  }

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
