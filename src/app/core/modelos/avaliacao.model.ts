/** Toda avaliação nova do público nasce 'pendente' — só fica visível na página do produto
 * depois que o admin aprova em `/admin/avaliacoes`. Avaliações cadastradas direto pelo admin
 * (cadastro manual, sempre existiu) continuam valendo como 'aprovada' automaticamente. */
export type StatusAvaliacao = 'pendente' | 'aprovada' | 'rejeitada';

export interface Avaliacao {
  id: string;
  /** Ausente quando a avaliação é um depoimento geral da loja, não vinculado a um produto
   * específico. */
  produtoId?: string | null;
  nomeCliente: string;
  /** 1 a 5. */
  nota: number;
  comentario?: string | null;
  /** ISO 8601. Editável no admin pra permitir cadastrar depoimentos retroativos. */
  criadoEm: string;
  status: StatusAvaliacao;
}
