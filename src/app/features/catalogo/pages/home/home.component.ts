import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { BannerRepositorio } from '../../../../core/servicos/banner.repositorio';
import { CarrosselComponent } from '../../../../shared/componentes/carrossel/carrossel.component';
import { CarrosselProdutosComponent } from '../../../../shared/componentes/carrossel-produtos/carrossel-produtos.component';
import { VistosRecentementeComponent } from '../../../../shared/componentes/vistos-recentemente/vistos-recentemente.component';
import { SeoService } from '../../../../core/servicos/seo.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CarrosselComponent, CarrosselProdutosComponent, VistosRecentementeComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly bannerRepositorio = inject(BannerRepositorio);
  private readonly seoService = inject(SeoService);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);

  readonly nomeLoja = computed(() => this.configuracaoLojaService.configuracao()?.nomeLoja ?? '');

  constructor() {
    this.seoService.redefinirPadrao();
  }

  readonly banners = toSignal(this.bannerRepositorio.obterBanners('home'), { initialValue: [] });

  readonly produtosDestaque = toSignal(this.catalogoRepositorio.obterProdutosEmDestaque(), {
    initialValue: [],
  });

  readonly produtosPromocao = toSignal(this.catalogoRepositorio.obterProdutosEmPromocao(), {
    initialValue: [],
  });

  readonly categorias = toSignal(this.catalogoRepositorio.obterCategorias(), {
    initialValue: [],
  });

  private readonly produtos = toSignal(this.catalogoRepositorio.obterProdutos(), {
    initialValue: [],
  });

  /** Quantidade real de peças por categoria — calculada a partir do catálogo, nunca fixa. */
  readonly quantidadePorCategoria = computed(() => {
    const contagem = new Map<string, number>();
    for (const produto of this.produtos()) {
      for (const slug of produto.categorias) {
        contagem.set(slug, (contagem.get(slug) ?? 0) + 1);
      }
    }
    return contagem;
  });

  readonly totalProdutos = computed(() => this.produtos().length);

  readonly primeiraCategoria = computed(() => this.categorias()[0] ?? null);
}
