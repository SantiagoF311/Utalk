// Primero que todo: Sentry tiene que inicializarse antes que el resto.
import './instrument.js';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { parseCorsOrigins } from './common/corsOrigins.js';
import { ProblemDetailsFilter } from './common/problemDetails.filter.js';

async function bootstrap() {
  // El adaptador se pasa explícito: si no, @nestjs/core lo carga por su
  // cuenta desde donde npm lo haya instalado, y en el monorepo core puede
  // quedar en la raíz y platform-express anidado en apps/backend (por un
  // conflicto de versiones de express con el mobile), donde core no lo ve.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter());

  // Detrás del proxy de Fly.io: sin esto, todas las requests parecen venir
  // de la IP del proxy y el rate limiting las contaría como un solo cliente.
  app.set('trust proxy', 1);

  // Headers de seguridad estándar (nosniff, HSTS, no exponer X-Powered-By…).
  app.use(helmet());

  app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGINS) });
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
