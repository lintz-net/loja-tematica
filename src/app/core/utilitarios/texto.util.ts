/** Normaliza texto pra comparação tolerante a acento/caixa (ex.: "São Paulo" vs "sao paulo")
 * — usado pra bater nome de cidade digitado pelo cliente contra a lista configurada pelo
 * admin sem depender de digitação idêntica. */
export function normalizarTexto(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
