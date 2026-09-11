export type StatusPedido = 'recebido' | 'confirmado' | 'enviado' | 'entregue';

export interface ItemPedido {
  produtoNome: string;
  produtoSlug: string;
  imagem: string;
  tamanho: string;
  cor: string;
  quantidade: number;
  precoUnitario: number;
}

export interface EnderecoPedido {
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface Pedido {
  codigo: string;
  criadoEm: string;
  status: StatusPedido;
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  /** CPF ou CNPJ do cliente — exigido pelo Melhor Envio como documento do destinatário na
   * compra da etiqueta. Ausente em pedidos de antes dessa coleta existir no checkout. */
  documentoCliente?: string;
  endereco: EnderecoPedido;
  itens: ItemPedido[];
  formaPagamento: 'cartao' | 'pix';
  parcelas: number;
  valorFrete: number;
  valorTotal: number;
  /** Serviço de frete escolhido no checkout (Melhor Envio) — usado depois pra comprar a
   * etiqueta. Ausente em pedidos antigos, de antes dessa integração existir. */
  freteServicoId?: string;
  freteTransportadora?: string;
  freteServicoNome?: string;
  fretePrazoDias?: number;
  /** Cupom aplicado no checkout, se algum — ausente na maioria dos pedidos. */
  cupomCodigo?: string;
  valorDesconto?: number;
}
