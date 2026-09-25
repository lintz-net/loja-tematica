import { normalizarTexto } from './texto.util';

describe('normalizarTexto', () => {
  it('remove acentos', () => {
    expect(normalizarTexto('São Paulo')).toBe('sao paulo');
  });

  it('deixa em minúsculas', () => {
    expect(normalizarTexto('INDAIATUBA')).toBe('indaiatuba');
  });

  it('remove espaços nas pontas', () => {
    expect(normalizarTexto('  Indaiatuba  ')).toBe('indaiatuba');
  });

  it('mantém espaços internos', () => {
    expect(normalizarTexto('Vista Nostálgica')).toBe('vista nostalgica');
  });

  it('duas grafias equivalentes normalizam pro mesmo valor', () => {
    expect(normalizarTexto('São Paulo')).toBe(normalizarTexto('  sao PAULO  '));
  });
});
