import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { ErrorCode, FieldError, ProblemDetails } from '@utalk/shared';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppException } from './appException.js';
import { ERROR_CATALOG, genericCodeForStatus } from './errorCatalog.js';

// `type` de RFC 9457: identifica el tipo de error con una URI. Se usa una
// URN (no una URL) porque no hay una página de documentación detrás; el RFC
// solo exige que sea única y estable.
function typeFor(code: ErrorCode): string {
  return `urn:utalk:error:${code.toLowerCase().replaceAll('_', '-')}`;
}

// Las excepciones de Nest guardan el mensaje como string o como
// { message: string | string[] }.
function detailOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message.join('; ');
  }
  return typeof message === 'string' ? message : exception.message;
}

// Filtro global: toda respuesta de error de la API sale con la misma forma
// (Problem Details de RFC 9457 + `code` y `errors`), venga de donde venga:
// AppException lanzada por un service, ZodError de un `schema.parse(...)`,
// una excepción propia de Nest (ParseUUIDPipe, ruta inexistente, JSON
// inválido) o un error inesperado.
//
// Todo lo que sale con status 5xx se reporta a Sentry (falla nuestra); los
// 4xx no (validación, permisos, no existe: son respuestas esperables).
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(
    private readonly reportError: (error: unknown) => unknown = Sentry.captureException,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    let code: ErrorCode;
    let detail: string;
    let errors: FieldError[] = [];

    if (exception instanceof AppException) {
      code = exception.code;
      detail = exception.message;
    } else if (exception instanceof ZodError) {
      code = 'VALIDATION_FAILED';
      detail = 'Request validation failed';
      errors = exception.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
    } else if (exception instanceof HttpException) {
      code = genericCodeForStatus(exception.getStatus());
      detail = detailOf(exception);
    } else {
      // Error no previsto (típicamente un error de Supabase/Postgres que el
      // repositorio no tradujo). El detalle real queda solo en el log: al
      // cliente nunca le llegan mensajes internos de la base.
      code = 'INTERNAL_ERROR';
      detail = 'An unexpected error occurred';
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Una excepción de Nest con un status fuera del catálogo (ej. 405, 413)
    // conserva su status real aunque caiga en un código genérico.
    const status =
      exception instanceof HttpException && !(exception instanceof AppException)
        ? exception.getStatus()
        : ERROR_CATALOG[code].status;

    if (status >= 500) {
      this.reportError(exception);
    }

    const problem: ProblemDetails = {
      type: typeFor(code),
      title: ERROR_CATALOG[code].title,
      status,
      detail,
      instance: request.path,
      code,
      errors,
    };

    response.status(status).type('application/problem+json').json(problem);
  }
}
