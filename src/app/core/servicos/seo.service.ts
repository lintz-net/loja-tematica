import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface DadosSeo {
  titulo: string;
  descricao: string;
  imagem?: string;
  url?: string;
  tipo?: 'website' | 'product';
}

const TITULO_SITE = 'Nostálgika';
const DESCRICAO_PADRAO =
  'Camisetas, bermudas e polos com estampas que remetem a games, cinema, música, futebol, carros e humor.';
const IMAGEM_PADRAO = `${environment.siteUrl}/og-padrao.jpg`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** Define título e meta tags (description, Open Graph, Twitter Card) da página atual.
   * Chamado a partir do componente de cada rota (home, produto, categoria) assim que os
   * dados relevantes carregam — em SSR, isso acontece antes da página ser serializada,
   * então o crawler recebe o HTML já com as tags certas (essencial pro preview de link no
   * WhatsApp/Instagram/Facebook). */
  definir(dados: DadosSeo): void {
    const tituloCompleto = dados.titulo === TITULO_SITE ? TITULO_SITE : `${dados.titulo} · ${TITULO_SITE}`;
    this.title.setTitle(tituloCompleto);

    this.definirTag('description', dados.descricao);
    this.definirTagPropriedade('og:title', tituloCompleto);
    this.definirTagPropriedade('og:description', dados.descricao);
    this.definirTagPropriedade('og:type', dados.tipo ?? 'website');
    const imagemAbsoluta = this.tornarAbsoluta(dados.imagem) ?? IMAGEM_PADRAO;
    this.definirTagPropriedade('og:image', imagemAbsoluta);
    if (dados.url) {
      this.definirTagPropriedade('og:url', dados.url);
    }
    this.definirTag('twitter:card', 'summary_large_image');
    this.definirTag('twitter:title', tituloCompleto);
    this.definirTag('twitter:description', dados.descricao);
    this.definirTag('twitter:image', imagemAbsoluta);
  }

  /** Crawlers de redes sociais exigem og:image absoluto — imagens do catálogo hoje vêm
   * com caminho relativo (ex.: /imagens/produtos/...). */
  private tornarAbsoluta(caminho: string | undefined): string | undefined {
    if (!caminho) return undefined;
    if (/^https?:\/\//.test(caminho)) return caminho;
    return `${environment.siteUrl}${caminho.startsWith('/') ? '' : '/'}${caminho}`;
  }

  /** Restaura os valores padrão do site — usado por páginas sem dados próprios de SEO. */
  redefinirPadrao(): void {
    this.definir({ titulo: TITULO_SITE, descricao: DESCRICAO_PADRAO });
  }

  private definirTag(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private definirTagPropriedade(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }
}
