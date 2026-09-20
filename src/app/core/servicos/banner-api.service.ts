import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Banner, DestinoBanner } from '../modelos/banner.model';
import { BannerRepositorio } from './banner.repositorio';
import { SupabaseRestService } from './supabase-rest.service';

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

@Injectable()
export class BannerApiService implements BannerRepositorio {
  private readonly rest = inject(SupabaseRestService);

  obterBanners(destino?: DestinoBanner): Observable<Banner[]> {
    const filtroDestino = destino ? `&destino=eq.${destino}` : '';
    return this.rest
      .select<LinhaBanner[]>('banners', `?select=*&order=ordem.asc${filtroDestino}`)
      .pipe(map((linhas) => linhas.map(linhaParaBanner)));
  }
}
