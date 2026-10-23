import { localized, type Locale, type Localized } from '../../../shared/i18n/locale';
import type { ErrorCode } from '../../../shared/types/entities';

export class AppError extends Error {
  /** The message in every supported locale; the exception filter picks one from the request's Accept-Language. */
  readonly text: Localized;

  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string | Localized,
    public readonly details: Record<string, unknown> | null = null,
  ) {
    const text = typeof message === 'string' ? localized(message, message) : message;
    super(text.en);
    this.text = text;
    this.name = 'AppError';
  }
}

/** Localized message of any thrown value; third-party errors (LLM providers, network) keep their own text. */
export function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof AppError) return error.text[locale];
  return error instanceof Error ? error.message : String(error);
}

const resourceNames: Record<string, Localized> = {
  Problem: localized('Problema', 'Problem'),
  Article: localized('Artigo', 'Article'),
  Pack: localized('Pacote', 'Pack'),
  'Hub pack': localized('Pacote do hub', 'Hub pack'),
  Session: localized('Sessão', 'Session'),
  Evaluation: localized('Avaliação', 'Evaluation'),
};

export function notFound(resource: string, id: string): AppError {
  const name = resourceNames[resource] ?? localized(resource, resource);
  return new AppError(404, 'NOT_FOUND', localized(`${name['pt-BR']} com ID '${id}' não encontrado(a).`, `${name.en} with ID '${id}' was not found`));
}
