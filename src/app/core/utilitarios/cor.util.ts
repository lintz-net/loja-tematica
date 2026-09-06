const MAPA_CORES: Record<string, string> = {
  preto: '#1a1a1a',
  branco: '#f5f5f5',
  cinza: '#8a8a8a',
  'cinza chumbo': '#4a4a4a',
  vermelho: '#d0312d',
  verde: '#2e8b57',
  'verde claro': '#7cbf6b',
  'verde musgo': '#5c6b3a',
  azul: '#2b5daa',
  'azul marinho': '#1c2f52',
  'azul claro': '#7ea9d9',
  'azul jeans': '#4a6fa1',
  amarelo: '#f2c230',
  roxo: '#7b2ff7',
  laranja: '#ff8a00',
  rosa: '#ff6fa5',
  bege: '#d8c3a0',
  marrom: '#6b4226',
  dourado: '#c9a227',
  prata: '#c0c0c0',
  mostarda: '#c99a2e',
  vinho: '#5e1a2e',
  'amarelo e azul': 'linear-gradient(135deg, #f2c230 50%, #2b5daa 50%)',
  colorido: 'linear-gradient(135deg, #ff2d6f, #7b2ff7, #00d4ff, #f2c230)',
};

/** Resolve o nome de uma cor (em português, como cadastrado no produto) para um valor CSS de swatch. */
export function corParaEstiloSwatch(nomeCor: string): string {
  const chave = nomeCor.trim().toLowerCase();
  return MAPA_CORES[chave] ?? '#9a9aa5';
}

/** Nomes de cor conhecidos (capitalizados), pra oferecer como opção fixa em vez de texto
 * livre — evita variantes com nome de cor digitado errado/inconsistente. */
export const CORES_CONHECIDAS: string[] = Object.keys(MAPA_CORES).map(
  (chave) => chave.charAt(0).toUpperCase() + chave.slice(1)
);
