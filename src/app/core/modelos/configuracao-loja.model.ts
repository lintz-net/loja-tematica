export interface CidadeFreteGratis {
  cidade: string;
  uf: string;
}

export interface ConfiguracaoLoja {
  nomeLoja: string;
  descricaoPadrao: string;
  emailContato: string;
  /** Só dígitos, com DDI e DDD — ex.: 5519991354644. */
  whatsappNumero: string;
  whatsappMensagem: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  /** Cidades onde a loja entrega/retira pessoalmente — nessas, o checkout pula a cotação do
   * Melhor Envio e oferece frete grátis direto. */
  cidadesFreteGratis: CidadeFreteGratis[];
  /** Mensagens rotativas da barra de anúncio acima do cabeçalho (frete grátis, parcelamento
   * sem juros, prazo de entrega etc.) — vazio faz a barra não aparecer. */
  mensagensBarraAnuncio: string[];
  /** Habilita uma terceira opção no checkout, "Combinar pagamento" — pedido é criado sem
   * passar pelo Mercado Pago, pagamento fica pendente até o admin confirmar manualmente em
   * `/admin/pedidos`. Padrão desligado: Pix/cartão via Mercado Pago seguem sendo as únicas
   * opções até o lojista optar por isso. */
  aceitaPagamentoManual: boolean;
}
