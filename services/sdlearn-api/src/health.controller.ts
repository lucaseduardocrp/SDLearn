import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthResponse } from '../../shared/types/api';
import { PostgresService } from './persistence/postgres.service';
import { WorkbenchService } from './workbench.service';

@Controller('health')
export class HealthController {
  constructor(private readonly postgres: PostgresService, private readonly workbench: WorkbenchService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const databaseReady = await this.postgres.healthCheck();
    if (!databaseReady) response.status(503);
    const judgeProvider = this.workbench.judgeProviderName;
    return {
      status: databaseReady ? 'ok' : 'degraded',
      services: {
        api: 'ok',
        database: databaseReady ? 'ok' : 'unavailable',
        'ai-judges': judgeProvider ? 'ok' : 'unavailable',
      },
      judgeProvider,
    };
  }
}
