/** Número máximo de parcelas sem juros oferecido no checkout e exibido nos cards de produto
 * (home/listagem). Sem configuração por loja hoje — se precisar variar por loja no futuro,
 * mover pra `configuracao_loja`. */
export const MAX_PARCELAS = 6;

/** Valor mínimo aceito por parcela — evita oferecer parcelamento que resulte em parcelas
 * irrisórias (ex.: 6x de R$3,33 num pedido de R$20) e problemas com o mínimo por parcela que
 * o próprio Mercado Pago costuma exigir. */
export const VALOR_MINIMO_PARCELA = 5;

/** Quantidade de parcelas sem juros oferecidas pro valor do pedido — limitada por
 * MAX_PARCELAS e por VALOR_MINIMO_PARCELA, nunca menor que 1x. */
export function parcelasDisponiveis(valorTotal: number): number {
  return Math.max(1, Math.min(MAX_PARCELAS, Math.floor(valorTotal / VALOR_MINIMO_PARCELA)));
}
