import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Categoria, SlugCategoria } from '../modelos/categoria.model';
import { FaixaMedida, Produto, VarianteProduto } from '../modelos/produto.model';
import { CatalogoRepositorio } from './catalogo.repositorio';
import { SupabaseRestService } from './supabase-rest.service';

interface LinhaCategoria {
  id: string;
  nome: string;
  slug: string;
  cor_tema: string;
  descricao_curta: string;
  icone: string;
}

interface LinhaProduto {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  preco_base: number;
  categorias: SlugCategoria[];
  imagens: string[];
  imagens_por_cor: Record<string, string[]> | null;
  guia_medidas: FaixaMedida[] | null;
  variantes: VarianteProduto[];
}

function linhaParaCategoria(linha: LinhaCategoria): Categoria {
  return {
    id: linha.id,
    nome: linha.nome,
    slug: linha.slug as SlugCategoria,
    corTema: linha.cor_tema,
    descricaoCurta: linha.descricao_curta,
    icone: linha.icone,
  };
}

function linhaParaProduto(linha: LinhaProduto): Produto {
  return {
    id: linha.id,
    nome: linha.nome,
    slug: linha.slug,
    descricao: linha.descricao,
    precoBase: linha.preco_base,
    categorias: linha.categorias,
    imagens: linha.imagens,
    imagensPorCor: linha.imagens_por_cor ?? undefined,
    guiaMedidas: linha.guia_medidas ?? undefined,
    variantes: linha.variantes,
  };
}

/** Implementação real do catálogo, consumindo as tabelas `categorias`/`produtos` no
 * Supabase via REST (ver docs/supabase/migration-004-catalogo.sql). */
@Injectable()
export class CatalogoApiService implements CatalogoRepositorio {
  private readonly rest = inject(SupabaseRestService);

  obterCategorias(): Observable<Categoria[]> {
    return this.rest
      .select<LinhaCategoria[]>('categorias', '?select=*')
      .pipe(map((linhas) => linhas.map(linhaParaCategoria)));
  }

  obterCategoriaPorSlug(slug: string): Observable<Categoria | undefined> {
    return this.rest
      .select<LinhaCategoria[]>('categorias', `?select=*&slug=eq.${encodeURIComponent(slug)}`)
      .pipe(map((linhas) => (linhas[0] ? linhaParaCategoria(linhas[0]) : undefined)));
  }

  obterProdutos(): Observable<Produto[]> {
    return this.rest
      .select<LinhaProduto[]>('produtos', '?select=*')
      .pipe(map((linhas) => linhas.map(linhaParaProduto)));
  }

  obterProdutosPorCategoria(slugCategoria: string): Observable<Produto[]> {
    const filtro = encodeURIComponent(JSON.stringify([slugCategoria]));
    return this.rest
      .select<LinhaProduto[]>('produtos', `?select=*&categorias=cs.${filtro}`)
      .pipe(map((linhas) => linhas.map(linhaParaProduto)));
  }

  obterProdutoPorSlug(slug: string): Observable<Produto | undefined> {
    return this.rest
      .select<LinhaProduto[]>('produtos', `?select=*&slug=eq.${encodeURIComponent(slug)}`)
      .pipe(map((linhas) => (linhas[0] ? linhaParaProduto(linhas[0]) : undefined)));
  }
}
