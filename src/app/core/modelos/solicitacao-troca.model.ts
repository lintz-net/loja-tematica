export type TipoSolicitacaoTroca = 'troca' | 'devolucao';

export type StatusSolicitacaoTroca = 'pendente' | 'em_analise' | 'aprovada' | 'recusada' | 'concluida';

/** Snapshot do item escolhido pro cliente pedir troca/devolução — mesma ideia de
 * `ItemPedido` (não existe um id de item estável em `pedidos.itens` pra referenciar). */
export interface ItemSolicitacaoTroca {
  produtoNome: string;
  produtoSlug: string;
  tamanho: string;
  cor: string;
  quantidade: number;
}

export interface SolicitacaoTroca {
  id: string;
  pedidoCodigo: string;
  emailCliente: string;
  tipo: TipoSolicitacaoTroca;
  itens: ItemSolicitacaoTroca[];
  motivo: string;
  observacoes?: string;
  status: StatusSolicitacaoTroca;
  respostaAdmin?: string;
  criadoEm: string;
  atualizadoEm: string;
}
