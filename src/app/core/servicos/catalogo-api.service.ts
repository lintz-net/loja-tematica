import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Categoria } from '../modelos/categoria.model';
import { Produto } from '../modelos/produto.model';
import { CatalogoRepositorio } from './catalogo.repositorio';

/** Implementação real do catálogo, consumindo a API via HttpClient. */
@Injectable()
export class CatalogoApiService implements CatalogoRepositorio {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  obterCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.baseUrl}/categorias`);
  }

  obterCategoriaPorSlug(slug: string): Observable<Categoria | undefined> {
    return this.http.get<Categoria | undefined>(`${this.baseUrl}/categorias/${slug}`);
  }

  obterProdutos(): Observable<Produto[]> {
    return this.http.get<Produto[]>(`${this.baseUrl}/produtos`);
  }

  obterProdutosPorCategoria(slugCategoria: string): Observable<Produto[]> {
    return this.http.get<Produto[]>(`${this.baseUrl}/categorias/${slugCategoria}/produtos`);
  }

  obterProdutoPorSlug(slug: string): Observable<Produto | undefined> {
    return this.http.get<Produto | undefined>(`${this.baseUrl}/produtos/${slug}`);
  }
}
