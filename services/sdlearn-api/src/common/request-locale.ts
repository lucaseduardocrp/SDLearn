import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { resolveLocale, type Locale } from '../../../shared/i18n/locale';

export function localeOf(request: Request): Locale {
  return resolveLocale(request.headers['accept-language']);
}

/** Injects the locale negotiated from the request's Accept-Language header (pt-BR when absent). */
export const RequestLocale = createParamDecorator((_data: unknown, context: ExecutionContext): Locale => localeOf(context.switchToHttp().getRequest<Request>()));
