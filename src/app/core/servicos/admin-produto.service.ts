import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { FaixaMedida, Produto, VarianteProduto } from '../modelos/produto.model';
import { SlugCategoria } from '../modelos/categoria.model';
import { obterSupabaseClient } from './supabase.client';

const BUCKET = 'produtos';

/** Linha da tabela `produtos` no Supabase (snake_case). */
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

function produtoParaLinha(produto: Produto): LinhaProduto {
  return {
    id: produto.id,
    nome: produto.nome,
    slug: produto.slug,
    descricao: produto.descricao,
    preco_base: produto.precoBase,
    categorias: produto.categorias,
    imagens: produto.imagens,
    imagens_por_cor: produto.imagensPorCor ?? null,
    guia_medidas: produto.guiaMedidas ?? null,
    variantes: produto.variantes,
  };
}

/** Operações de escrita no catálogo (criar/editar/excluir produto, upload de imagem) — só
 * usadas em `/admin`, que só roda no browser (nunca durante SSR) e exige login. Usa o
 * cliente completo do Supabase (com sessão), ao contrário de `CatalogoApiService`
 * (leitura pública via REST puro): aqui a policy de insert/update/delete exige role
 * 'authenticated', obtida da sessão logada do admin. */
@Injectable({ providedIn: 'root' })
export class AdminProdutoService {
  obterPorId(id: string): Observable<Produto | undefined> {
    const promessa = obterSupabaseClient()
      .from('produtos')
      .select()
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        return data ? linhaParaProduto(data as LinhaProduto) : undefined;
      });

    return from(promessa);
  }

  criar(produto: Produto): Observable<Produto> {
    const promessa = obterSupabaseClient()
      .from('produtos')
      .insert(produtoParaLinha(produto))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaProduto(data as LinhaProduto);
      });

    return from(promessa);
  }

  atualizar(produto: Produto): Observable<Produto> {
    const promessa = obterSupabaseClient()
      .from('produtos')
      .update(produtoParaLinha(produto))
      .eq('id', produto.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaProduto(data as LinhaProduto);
      });

    return from(promessa);
  }

  excluir(id: string): Observable<void> {
    const promessa = obterSupabaseClient()
      .from('produtos')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }

  /** Sobe uma imagem pro Storage e devolve a URL pública, já pronta pra entrar no array
   * `imagens` do produto. */
  enviarImagem(slug: string, arquivo: File): Observable<string> {
    const caminho = `${slug}/${Date.now()}-${arquivo.name}`;
    const promessa = obterSupabaseClient()
      .storage.from(BUCKET)
      .upload(caminho, arquivo, { upsert: true })
      .then(({ error }) => {
        if (error) throw error;
        const { data } = obterSupabaseClient().storage.from(BUCKET).getPublicUrl(caminho);
        return data.publicUrl;
      });

    return from(promessa);
  }
}
