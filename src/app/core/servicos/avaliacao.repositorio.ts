import { Observable } from 'rxjs';
import { Avaliacao } from '../modelos/avaliacao.model';

/**
 * Contrato de acesso público às avaliações (leitura). Mesmo padrão de `CatalogoRepositorio`/
 * `BannerRepositorio`. Escrita (criar/editar/remover) é feita só pelo admin, via
 * `AdminAvaliacaoService` — sem formulário público de submissão.
 */
export abstract class AvaliacaoRepositorio {
  abstract obterAvaliacoesPorProduto(produtoId: string): Observable<Avaliacao[]>;
}
