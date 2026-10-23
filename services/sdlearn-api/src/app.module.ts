import { Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './config/app-config';
import { ContentService } from './content/content.service';
import { HubController } from './content/hub.controller';
import { HubService } from './content/hub.service';
import { HealthController } from './health.controller';
import { PostgresService } from './persistence/postgres.service';
import { RecordStore } from './persistence/record-store';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchService } from './workbench.service';

@Module({
  controllers: [HealthController, WorkbenchController, SettingsController, HubController],
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    PostgresService,
    RecordStore,
    SettingsService,
    ContentService,
    HubService,
    WorkbenchService,
  ],
})
export class AppModule {}
