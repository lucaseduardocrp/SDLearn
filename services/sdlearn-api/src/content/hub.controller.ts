import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { packIdSchema } from '../../../shared/schemas/validation';
import type { Locale } from '../../../shared/i18n/locale';
import { RequestLocale } from '../common/request-locale';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContentService } from './content.service';
import { HubService } from './hub.service';

@Controller()
export class HubController {
  constructor(private readonly hub: HubService, private readonly content: ContentService) {}

  @Get('hub')
  listing(@RequestLocale() locale: Locale) {
    return this.hub.listing(locale);
  }

  @Post('hub/packs/:packId/install')
  async install(@Param('packId', new ZodValidationPipe(packIdSchema)) packId: string) {
    return { pack: await this.hub.install(packId) };
  }

  @Get('packs')
  async installed() {
    return { items: await this.content.listInstalled(), nextCursor: null };
  }

  @Post('packs/import')
  async import(@Body() bundle: unknown) {
    return { pack: await this.hub.import(bundle) };
  }

  @Delete('packs/:packId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(@Param('packId', new ZodValidationPipe(packIdSchema)) packId: string, @Query('force') force?: string) {
    await this.content.uninstall(packId, force === 'true');
  }
}
