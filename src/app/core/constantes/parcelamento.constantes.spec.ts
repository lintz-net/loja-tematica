import { MAX_PARCELAS, VALOR_MINIMO_PARCELA, parcelasDisponiveis } from './parcelamento.constantes';

describe('parcelasDisponiveis', () => {
  it('devolve 1 pra valores muito baixos (menos que o mínimo por parcela)', () => {
    expect(parcelasDisponiveis(0)).toBe(1);
    expect(parcelasDisponiveis(VALOR_MINIMO_PARCELA - 0.01)).toBe(1);
  });

  it('devolve o número de parcelas de VALOR_MINIMO_PARCELA em VALOR_MINIMO_PARCELA', () => {
    expect(parcelasDisponiveis(VALOR_MINIMO_PARCELA * 2)).toBe(2);
    expect(parcelasDisponiveis(VALOR_MINIMO_PARCELA * 3 - 0.01)).toBe(2);
    expect(parcelasDisponiveis(VALOR_MINIMO_PARCELA * 3)).toBe(3);
  });

  it('nunca passa de MAX_PARCELAS mesmo com valor muito alto', () => {
    expect(parcelasDisponiveis(VALOR_MINIMO_PARCELA * 1000)).toBe(MAX_PARCELAS);
  });

  it('nunca devolve menos que 1, mesmo com valor negativo', () => {
    expect(parcelasDisponiveis(-50)).toBe(1);
  });
});
