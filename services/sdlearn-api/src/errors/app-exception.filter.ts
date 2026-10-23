import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ErrorCode, ErrorResponse } from '../../../shared/types/entities';
import { localeOf } from '../common/request-locale';
import { AppError } from './app-error';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    const locale = localeOf(request);
    let message = locale === 'en' ? 'An internal error occurred' : 'Ocorreu um erro interno.';
    let details: Record<string, unknown> | null = null;

    if (exception instanceof AppError) {
      status = exception.statusCode;
      code = exception.code;
      message = exception.text[locale];
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = 'VALIDATION_ERROR';
      message = locale === 'en' ? 'Request validation failed' : 'A requisição é inválida.';
      details = { issues: exception.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR';
      const payload = exception.getResponse();
      message = typeof payload === 'string' ? payload : exception.message;
    } else {
      const errorMessage = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(JSON.stringify({ event: 'request.failed', path: request.url, error: errorMessage }));
      if (process.env.APP_ENV === 'Development') message = errorMessage;
    }

    const body: ErrorResponse = { error: { code, message, details } };
    response.status(status).json(body);
  }
}