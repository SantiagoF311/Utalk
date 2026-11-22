import { describe, expect, it } from '@jest/globals';
import { REPORT_DETAIL_MAX_LENGTH } from '@utalk/shared';
import { aiReportFor } from './aiReport.js';

describe('aiReportFor', () => {
  it('violencia y amenazas cuentan como amenaza (urgente en la cola)', () => {
    expect(aiReportFor(['violence']).category).toBe('threat');
    expect(aiReportFor(['harassment/threatening']).category).toBe('threat');
    expect(aiReportFor(['hate', 'illicit/violent']).category).toBe('threat');
  });

  it('acoso y odio, como acoso', () => {
    expect(aiReportFor(['harassment']).category).toBe('harassment');
    expect(aiReportFor(['hate', 'sexual']).category).toBe('harassment');
  });

  it('el resto, como "otro"', () => {
    expect(aiReportFor(['sexual']).category).toBe('other');
    expect(aiReportFor(['self-harm']).category).toBe('other');
  });

  it('el detalle dice que fue la IA y qué detectó, en español', () => {
    expect(aiReportFor(['harassment', 'violence/graphic']).reason).toBe(
      'Detectado por IA: acoso, violencia explícita',
    );
  });

  it('una categoría nueva del proveedor se muestra tal cual', () => {
    expect(aiReportFor(['algo-nuevo']).reason).toBe('Detectado por IA: algo-nuevo');
  });

  it('el detalle no pasa del máximo de un reporte', () => {
    const many = Array.from({ length: 100 }, (_, i) => `categoria-larga-${i}`);

    expect(aiReportFor(many).reason.length).toBeLessThanOrEqual(REPORT_DETAIL_MAX_LENGTH);
  });
});
