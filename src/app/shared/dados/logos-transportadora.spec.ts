import { obterLogoTransportadora } from './logos-transportadora';

describe('obterLogoTransportadora', () => {
  it('devolve null quando o nome é ausente', () => {
    expect(obterLogoTransportadora(undefined)).toBeNull();
    expect(obterLogoTransportadora(null)).toBeNull();
    expect(obterLogoTransportadora('')).toBeNull();
  });

  it('casa por substring, ignorando maiúsculas/minúsculas', () => {
    expect(obterLogoTransportadora('Jadlog')).toEqual(
      jasmine.objectContaining({ alt: 'Jadlog', arquivo: 'jadlog.webp' })
    );
    expect(obterLogoTransportadora('jadlog .com')).toEqual(
      jasmine.objectContaining({ alt: 'Jadlog' })
    );
  });

  it('ignora acentos na comparação', () => {
    expect(obterLogoTransportadora('Corrêios')).toEqual(
      jasmine.objectContaining({ alt: 'Correios' })
    );
  });

  it('devolve null quando não há logo pra transportadora', () => {
    expect(obterLogoTransportadora('Transportadora Desconhecida')).toBeNull();
  });
});
