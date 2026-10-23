import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { providerIdSchema, settingsUpdateSchema, type SettingsUpdateRequest } from '../../../shared/schemas/validation';
import type { ProviderId } from '../../../shared/types/entities';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AppError } from '../errors/app-error';
import { ProviderError } from '../judges/llm-provider';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.getPublic();
  }

  @Put()
  update(@Body(new ZodValidationPipe(settingsUpdateSchema)) input: SettingsUpdateRequest) {
    return this.settings.update(input);
  }

  @Get('providers/:providerId/models')
  async models(@Param('providerId', new ZodValidationPipe(providerIdSchema)) providerId: ProviderId) {
    const provider = await this.settings.provider(providerId);
    try {
      return { items: await provider.listModels() };
    } catch (error) {
      throw new AppError(502, 'SERVICE_UNAVAILABLE', error instanceof Error ? error.message : 'Could not list models.');
    }
  }

  /** Sends a tiny structured request so the user knows the key, endpoint and model work before judging. */
  @Post('providers/:providerId/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @Param('providerId', new ZodValidationPipe(providerIdSchema)) providerId: ProviderId,
    @Body() body: { model?: unknown },
  ) {
    if (typeof body?.model !== 'string' || !body.model.trim()) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a model to test.');
    const provider = await this.settings.provider(providerId);
    const started = Date.now();
    try {
      const answer = await provider.completeJson(body.model.trim(), {
        system: 'You are a connectivity check. Answer with the JSON requested.',
        user: 'Reply with {"ok": true}.',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
        schemaName: 'connectivity_check',
      }) as { ok?: unknown };
      return { ok: answer?.ok === true, latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof ProviderError || error instanceof Error ? error.message : 'The provider did not answer.';
      return { ok: false, latencyMs: Date.now() - started, error: message };
    }
  }
}
