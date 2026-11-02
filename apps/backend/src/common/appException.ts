import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@utalk/shared';
import { ERROR_CATALOG } from './errorCatalog.js';

// Error de la API con código estable. El status sale del catálogo, así que
// se lanza solo con el código y el detalle de este caso:
//   throw new AppException('POST_NOT_FOUND', `Post ${id} not found`);
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    detail: string,
  ) {
    super(detail, ERROR_CATALOG[code].status);
  }
}
