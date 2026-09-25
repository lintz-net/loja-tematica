import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Categoria } from '../modelos/categoria.model';
import { obterSupabaseClient } from './supabase.client';

/** Linha da tabela `categorias` no Supabase (snake_case). */
interface LinhaCategoria {
  id: string;
  nome: string;
  slug: string;
  cor_tema: string;
  descricao_curta: string;
  icone: string;
}

function linhaParaCategoria(linha: LinhaCategoria): Categoria {
  return {
    id: linha.id,
    nome: linha.nome,
    slug: linha.slug,
    corTema: linha.cor_tema,
    descricaoCurta: linha.descricao_curta,
    icone: linha.icone,
  };
}

function categoriaParaLinha(categoria: Omit<Categoria, 'id'>): Omit<LinhaCategoria, 'id'> {
  return {
    nome: categoria.nome,
    slug: categoria.slug,
    cor_tema: categoria.corTema,
    descricao_curta: categoria.descricaoCurta,
    icone: categoria.icone,
  };
}

/** Operações de escrita de categorias (criar/editar/excluir) — só usadas em
 * `/admin/categorias`, atrás de login. Até aqui, categoria nova só existia via SQL rodado à
 * mão no SQL Editor do Supabase (ver histórico em TODO.md); esse CRUD substitui isso. Mesmo
 * padrão de `AdminBannerService`/`AdminProdutoService` (cliente completo do Supabase, com
 * sessão, pra satisfazer a policy de insert/update/delete restrita a admin via `eh_admin()`). */
@Injectable({ providedIn: 'root' })
export class AdminCategoriaService {
  criar(categoria: Categoria): Observable<Categoria> {
    const promessa = obterSupabaseClient()
      .from('categorias')
      .insert({ id: categoria.id, ...categoriaParaLinha(categoria) })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaCategoria(data as LinhaCategoria);
      });

    return from(promessa);
  }

  atualizar(categoria: Categoria): Observable<Categoria> {
    const promessa = obterSupabaseClient()
      .from('categorias')
      .update(categoriaParaLinha(categoria))
      .eq('id', categoria.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaCategoria(data as LinhaCategoria);
      });

    return from(promessa);
  }

  /** Exclusão em si não valida nada — categorias não têm FK formal com produtos (o vínculo é
   * um array de slugs solto em `produtos.categorias`, sem integridade garantida pelo banco).
   * É `AdminCategoriasComponent` quem bloqueia excluir categoria com produto vinculado, antes
   * de chamar isto, pra não deixar produto apontando pra uma categoria que não existe mais. */
  excluir(id: string): Observable<void> {
    const promessa = obterSupabaseClient()
      .from('categorias')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }
}
