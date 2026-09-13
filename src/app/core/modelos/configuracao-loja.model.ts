export interface ConfiguracaoLoja {
  nomeLoja: string;
  descricaoPadrao: string;
  emailContato: string;
  /** Só dígitos, com DDI e DDD — ex.: 5519991354644. */
  whatsappNumero: string;
  whatsappMensagem: string;
  instagramUrl?: string;
  tiktokUrl?: string;
}
