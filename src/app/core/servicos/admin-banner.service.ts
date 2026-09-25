import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Banner, DestinoBanner } from '../modelos/banner.model';
import { SupabaseClienteService } from './supabase.client';

const BUCKET = 'banners';

interface LinhaBanner {
  id: string;
  imagem_url: string;
  alt: string;
  link: string | null;
  destino: DestinoBanner;
  ordem: number;
}

function linhaParaBanner(linha: LinhaBanner): Banner {
  return {
    id: linha.id,
    imagemUrl: linha.imagem_url,
    alt: linha.alt,
    link: linha.link ?? undefined,
    destino: linha.destino,
    ordem: linha.ordem,
  };
}

function bannerParaLinha(banner: Omit<Banner, 'id'>): Omit<LinhaBanner, 'id'> {
  return {
    imagem_url: banner.imagemUrl,
    alt: banner.alt,
    link: banner.link || null,
    destino: banner.destino,
    ordem: banner.ordem,
  };
}

/** Operações de escrita de banners (criar/editar/excluir, upload de imagem) — só usadas em
 * `/admin/banners`, atrás de login. CRUD de banner nunca existiu antes: até aqui os banners
 * só eram geridos direto no Supabase, sem UI. Mesmo padrão de `AdminProdutoService` (cliente
 * completo do Supabase, com sessão, pra satisfazer a policy de insert/update/delete restrita
 * a admin via `eh_admin()`). */
@Injectable({ providedIn: 'root' })
export class AdminBannerService {
  private readonly supabaseCliente = inject(SupabaseClienteService);

  listar(): Observable<Banner[]> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('banners')
      .select()
      .order('ordem', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaBanner[]).map(linhaParaBanner);
      });

    return from(promessa);
  }

  criar(banner: Omit<Banner, 'id'>): Observable<Banner> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('banners')
      .insert(bannerParaLinha(banner))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaBanner(data as LinhaBanner);
      });

    return from(promessa);
  }

  atualizar(id: string, banner: Omit<Banner, 'id'>): Observable<Banner> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('banners')
      .update(bannerParaLinha(banner))
      .eq('id', id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaBanner(data as LinhaBanner);
      });

    return from(promessa);
  }

  remover(id: string): Observable<void> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('banners')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }

  /** Sobe uma imagem de banner pro Storage e devolve a URL pública. */
  enviarImagem(arquivo: File): Observable<string> {
    const caminho = `${Date.now()}-${arquivo.name}`;
    const promessa = this.supabaseCliente.obterCliente()
      .storage.from(BUCKET)
      .upload(caminho, arquivo, { upsert: true })
      .then(({ error }) => {
        if (error) throw error;
        const { data } = this.supabaseCliente.obterCliente().storage.from(BUCKET).getPublicUrl(caminho);
        return data.publicUrl;
      });

    return from(promessa);
  }
}
