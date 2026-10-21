import type { ErrorCode } from '../../../shared/types/entities';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(resource: string, id: string): AppError {
  return new AppError(404, 'NOT_FOUND', `${resource} with ID '${id}' was not found`);
}