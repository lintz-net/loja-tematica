import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Categoria } from '../modelos/categoria.model';
import { Produto } from '../modelos/produto.model';
import { CatalogoRepositorio } from './catalogo.repositorio';
import { CATEGORIAS, PRODUTOS } from './dados/catalogo.mock-data';

/** Implementação em memória do catálogo, com latência artificial para simular uma API real. */
@Injectable()
export class CatalogoMockService implements CatalogoRepositorio {
  private simular<T>(valor: T): Observable<T> {
    return of(valor).pipe(delay(environment.mockDelayMs));
  }

  obterCategorias(): Observable<Categoria[]> {
    return this.simular(CATEGORIAS);
  }

  obterCategoriaPorSlug(slug: string): Observable<Categoria | undefined> {
    return this.simular(CATEGORIAS.find((categoria) => categoria.slug === slug));
  }

  obterProdutos(): Observable<Produto[]> {
    return this.simular(PRODUTOS);
  }

  obterProdutosPorCategoria(slugCategoria: string): Observable<Produto[]> {
    return this.simular(
      PRODUTOS.filter((produto) => produto.categorias.includes(slugCategoria as any))
    );
  }

  obterProdutoPorSlug(slug: string): Observable<Produto | undefined> {
    return this.simular(PRODUTOS.find((produto) => produto.slug === slug));
  }
}
