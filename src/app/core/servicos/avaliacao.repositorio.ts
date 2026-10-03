import { Observable } from 'rxjs';
import { Avaliacao } from '../modelos/avaliacao.model';

/**
 * Contrato de acesso público às avaliações. Mesmo padrão de `CatalogoRepositorio`/
 * `BannerRepositorio`. Edição/remoção continuam só pelo admin, via `AdminAvaliacaoService` —
 * `criar` aqui é a única escrita pública, e sempre nasce 'pendente' (RLS garante isso mesmo
 * que o app tenha um bug, ver migration-030-avaliacoes-publicas.sql).
 */
export abstract class AvaliacaoRepositorio {
  /** Só avaliações com status 'aprovada' — RLS já filtra isso (migration-030), mas o filtro
   * aqui também evita depender só da política do banco. */
  abstract obterAvaliacoesPorProduto(produtoId: string): Observable<Avaliacao[]>;

  abstract criar(dados: {
    produtoId: string;
    nomeCliente: string;
    nota: number;
    comentario?: string;
  }): Observable<void>;
}
