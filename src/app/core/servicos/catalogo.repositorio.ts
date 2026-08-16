import { Observable } from 'rxjs';
import { Categoria } from '../modelos/categoria.model';
import { Produto } from '../modelos/produto.model';

/**
 * Contrato de acesso a dados do catálogo. Usado como token de injeção: a implementação
 * concreta (mock ou API real) é decidida em app.config.ts via `environment.useMock`.
 */
export abstract class CatalogoRepositorio {
  abstract obterCategorias(): Observable<Categoria[]>;
  abstract obterCategoriaPorSlug(slug: string): Observable<Categoria | undefined>;
  abstract obterProdutos(): Observable<Produto[]>;
  abstract obterProdutosPorCategoria(slugCategoria: string): Observable<Produto[]>;
  abstract obterProdutoPorSlug(slug: string): Observable<Produto | undefined>;
}
