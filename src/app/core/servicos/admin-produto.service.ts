import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { FaixaMedida, GeneroProduto, Produto, VarianteProduto } from '../modelos/produto.model';
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
  videos: string[] | null;
  guia_medidas: FaixaMedida[] | null;
  genero: GeneroProduto | null;
  peso_kg: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
  variantes: VarianteProduto[];
  destaque: boolean;
  ordem_destaque: number | null;
  preco_promocional: number | null;
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
    videos: linha.videos ?? undefined,
    guiaMedidas: linha.guia_medidas ?? undefined,
    genero: linha.genero ?? undefined,
    pesoKg: linha.peso_kg ?? undefined,
    alturaCm: linha.altura_cm ?? undefined,
    larguraCm: linha.largura_cm ?? undefined,
    comprimentoCm: linha.comprimento_cm ?? undefined,
    variantes: linha.variantes,
    destaque: linha.destaque,
    ordemDestaque: linha.ordem_destaque ?? undefined,
    precoPromocional: linha.preco_promocional ?? undefined,
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
    videos: produto.videos ?? null,
    guia_medidas: produto.guiaMedidas ?? null,
    genero: produto.genero ?? null,
    peso_kg: produto.pesoKg ?? null,
    altura_cm: produto.alturaCm ?? null,
    largura_cm: produto.larguraCm ?? null,
    comprimento_cm: produto.comprimentoCm ?? null,
    variantes: produto.variantes,
    destaque: produto.destaque,
    ordem_destaque: produto.ordemDestaque ?? null,
    preco_promocional: produto.precoPromocional ?? null,
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
    return this.enviarArquivo(`${slug}/${Date.now()}-${arquivo.name}`, arquivo);
  }

  /** Sobe um vídeo pro mesmo bucket das imagens (sem restrição de mime configurada) e
   * devolve a URL pública, pronta pra entrar no array `videos` do produto. */
  enviarVideo(slug: string, arquivo: File): Observable<string> {
    return this.enviarArquivo(`${slug}/video-${Date.now()}-${arquivo.name}`, arquivo);
  }

  private enviarArquivo(caminho: string, arquivo: File): Observable<string> {
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

  /** Apaga o arquivo do Storage de verdade (não só tira do array `imagens`/`videos` do
   * produto) — extrai o caminho a partir da URL pública, já que é isso que a API de Storage
   * espera. Se a URL não for desse bucket (ex.: link externo digitado à mão), não faz nada.
   * Serve tanto pra imagem quanto pra vídeo, já que ambos vivem no mesmo bucket. */
  excluirImagem(url: string): Observable<void> {
    const marcador = `/${BUCKET}/`;
    const indice = url.indexOf(marcador);
    if (indice === -1) return of(undefined);

    const caminho = decodeURIComponent(url.slice(indice + marcador.length));
    const promessa = obterSupabaseClient()
      .storage.from(BUCKET)
      .remove([caminho])
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }
}
