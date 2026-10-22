import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig, loadConfig } from './config/app-config';
import { HealthController } from './health.controller';
import { createLlmProvider } from './judges/llm-provider';
import { PostgresService } from './persistence/postgres.service';
import { WorkbenchController } from './workbench.controller';
import { LLM_PROVIDER, WorkbenchService } from './workbench.service';

@Module({
  controllers: [HealthController, WorkbenchController],
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    { provide: LLM_PROVIDER, useFactory: (config: AppConfig) => createLlmProvider(config), inject: [APP_CONFIG] },
    PostgresService,
    WorkbenchService,
  ],
})
export class AppModule {}
