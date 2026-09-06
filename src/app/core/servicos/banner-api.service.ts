import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Banner } from '../modelos/banner.model';
import { BannerRepositorio } from './banner.repositorio';
import { SupabaseRestService } from './supabase-rest.service';

interface LinhaBanner {
  id: string;
  imagem_url: string;
  alt: string;
  link: string | null;
  ordem: number;
}

function linhaParaBanner(linha: LinhaBanner): Banner {
  return {
    id: linha.id,
    imagemUrl: linha.imagem_url,
    alt: linha.alt,
    link: linha.link ?? undefined,
  };
}

@Injectable()
export class BannerApiService implements BannerRepositorio {
  private readonly rest = inject(SupabaseRestService);

  obterBanners(): Observable<Banner[]> {
    return this.rest
      .select<LinhaBanner[]>('banners', '?select=*&order=ordem.asc')
      .pipe(map((linhas) => linhas.map(linhaParaBanner)));
  }
}
