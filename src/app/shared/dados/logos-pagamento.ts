export interface LogoPagamento {
  alt: string;
  arquivo: string;
}

/** Arquivos em public/imagens/pagamentos — baixados do brand center oficial de cada
 * bandeira, não copiados de outro site (ver conversa que decidiu isso). Usado no rodapé
 * (todas) e no checkout (só as de cartão, ver LOGOS_CARTAO). */
export const LOGOS_PAGAMENTO: LogoPagamento[] = [
  { alt: 'Visa', arquivo: 'visa.png' },
  { alt: 'Mastercard', arquivo: 'mastercard.png' },
  { alt: 'Elo', arquivo: 'elo.png' },
  { alt: 'Amex', arquivo: 'amex.png' },
  { alt: 'Hipercard', arquivo: 'hipercard.png' },
  { alt: 'Diners', arquivo: 'diners.png' },
  { alt: 'Aura', arquivo: 'aura.png' },
  { alt: 'Discover', arquivo: 'discover.png' },
  { alt: 'Boleto', arquivo: 'boleto.png' },
  { alt: 'Pix', arquivo: 'pix.png' },
];

/** Só as bandeiras de cartão de crédito — usado no checkout, na etapa de pagamento com
 * cartão (Pix e Boleto não fazem sentido ali, já são formas de pagamento à parte). */
export const LOGOS_CARTAO: LogoPagamento[] = LOGOS_PAGAMENTO.filter(
  (logo) => !['Boleto', 'Pix'].includes(logo.alt)
);
