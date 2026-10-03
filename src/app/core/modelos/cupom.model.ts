export type TipoDescontoCupom = 'percentual' | 'valor_fixo';

export interface Cupom {
  codigo: string;
  tipoDesconto: TipoDescontoCupom;
  valorDesconto: number;
  /** null/ausente = nunca expira. */
  expiraEm?: string;
  ativo: boolean;
  criadoEm: string;
  /** Pedido precisa ter pelo menos esse subtotal (antes do próprio desconto) pra poder usar o
   * cupom. Ausente = sem mínimo. */
  valorMinimoPedido?: number;
  /** Quantas vezes o MESMO e-mail pode usar esse cupom (conta pedidos já feitos com ele,
   * qualquer status). Ausente = sem limite. Por e-mail porque o checkout não exige login. */
  limiteUsoPorEmail?: number;
  /** Slugs de categoria — se preenchido, o desconto só incide sobre os itens do carrinho cuja
   * categoria bate (ver `categorias`/`produtosIds` em `validar-cupom`: a restrição é "OR" entre
   * as duas, item elegível se bater em qualquer uma). Ausente/vazio = sem restrição, desconto
   * no carrinho inteiro. */
  categorias?: string[];
  /** Ids de produto específicos — mesma lógica de `categorias` acima, união das duas regras. */
  produtosIds?: string[];
}
