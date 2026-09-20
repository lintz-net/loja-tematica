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
}
