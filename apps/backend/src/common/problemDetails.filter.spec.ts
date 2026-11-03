import { describe, expect, it, jest } from '@jest/globals';
import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import type { ProblemDetails } from '@utalk/shared';
import { z } from 'zod';
import { AppException } from './appException.js';
import { ProblemDetailsFilter } from './problemDetails.filter.js';

// Ejecuta el filtro con un request/response falsos y devuelve lo que habría
// respondido por HTTP.
function run(exception: unknown) {
  const sent: { status?: number; type?: string; body?: ProblemDetails } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    type(contentType: string) {
      sent.type = contentType;
      return this;
    },
    json(body: ProblemDetails) {
      sent.body = body;
      return this;
    },
  };
  const request = { method: 'POST', originalUrl: '/posts?x=1', path: '/posts' };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new ProblemDetailsFilter().catch(exception, host);
  return sent;
}

describe('ProblemDetailsFilter', () => {
  it('AppException: usa su código y toma el status del catálogo', () => {
    const sent = run(new AppException('CANNOT_PUBLISH_IN_PANEL', 'You cannot post in forum x'));

    expect(sent.status).toBe(403);
    expect(sent.type).toBe('application/problem+json');
    expect(sent.body).toEqual({
      type: 'urn:utalk:error:cannot-publish-in-panel',
      title: 'Cannot publish in this panel',
      status: 403,
      detail: 'You cannot post in forum x',
      instance: '/posts',
      code: 'CANNOT_PUBLISH_IN_PANEL',
      errors: [],
    });
  });

  it('ZodError: VALIDATION_FAILED con el detalle por campo', () => {
    const result = z.object({ title: z.string() }).safeParse({});
    const sent = run(result.error);

    expect(sent.status).toBe(400);
    expect(sent.body?.code).toBe('VALIDATION_FAILED');
    expect(sent.body?.errors).toEqual([{ path: 'title', message: expect.any(String) }]);
  });

  it('excepción propia de Nest: código genérico según su status', () => {
    const sent = run(new NotFoundException('Cannot GET /no-existe'));

    expect(sent.status).toBe(404);
    expect(sent.body?.code).toBe('NOT_FOUND');
    expect(sent.body?.detail).toBe('Cannot GET /no-existe');
  });

  it('error inesperado: 500 genérico, sin filtrar el mensaje interno, y lo loguea', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const sent = run(new Error('permission denied for table posts'));

    expect(sent.status).toBe(500);
    expect(sent.body?.code).toBe('INTERNAL_ERROR');
    expect(sent.body?.detail).not.toContain('permission denied');
    expect(log).toHaveBeenCalledWith(
      'POST /posts?x=1',
      expect.stringContaining('permission denied'),
    );
    log.mockRestore();
  });
});
