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
}
