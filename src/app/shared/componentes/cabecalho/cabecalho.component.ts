import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  HostListener,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';
import { BuscaService } from '../../../core/servicos/busca.service';
import { FavoritosService } from '../../../core/servicos/favoritos.service';
import { ConfiguracaoLojaService } from '../../../core/servicos/configuracao-loja.service';
import { CatalogoRepositorio } from '../../../core/servicos/catalogo.repositorio';
import { BannerRepositorio } from '../../../core/servicos/banner.repositorio';
import { AuthService } from '../../../core/servicos/auth.service';

/** Atraso ao tirar o mouse do item "Produtos"/painel antes de fechar o mega-menu — sem isso,
 * o pequeno vão entre o item do nav e o painel abaixo fecha o menu ao simplesmente descer o
 * mouse até ele. */
const ATRASO_FECHAR_MEGA_MENU_MS = 250;

@Component({
  selector: 'app-cabecalho',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cabecalho.component.html',
  styleUrl: './cabecalho.component.scss',
})
export class CabecalhoComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly buscaService = inject(BuscaService);
  private readonly favoritosService = inject(FavoritosService);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly bannerRepositorio = inject(BannerRepositorio);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly quantidadeTotalItens = this.carrinhoService.quantidadeTotalItens;
  readonly quantidadeFavoritos = this.favoritosService.quantidadeFavoritos;
  readonly valorTotalCarrinho = this.carrinhoService.valorTotal;
  readonly autenticado = this.authService.autenticado;

  readonly menuMobileAberto = signal(false);
  readonly nomeLoja = computed(() => this.configuracaoLojaService.configuracao()?.nomeLoja ?? '');

  /** Menu de navegação vem do catálogo (banco), não é uma lista fixa de categorias — cada
   * loja tem as suas próprias. Usado dentro do mega-menu "Produtos". */
  readonly categorias = toSignal(this.catalogoRepositorio.obterCategorias(), { initialValue: [] });

  private readonly bannersMenu = toSignal(this.bannerRepositorio.obterBanners('menu'), {
    initialValue: [],
  });

  /** Vários banners podem ter destino='menu' — sempre mostra o de maior `ordem` (sem precisar
   * desativar os antigos manualmente pra trocar o vigente). */
  readonly bannerMegaMenu = computed(() => {
    const banners = this.bannersMenu();
    if (banners.length === 0) return null;
    return banners.reduce((maior, atual) => (atual.ordem > maior.ordem ? atual : maior));
  });

  readonly megaMenuAberto = signal(false);
  private temporizadorFecharMegaMenu: ReturnType<typeof setTimeout> | null = null;

  readonly termoBuscaInline = signal('');

  constructor() {
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        this.menuMobileAberto.set(false);
        this.megaMenuAberto.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    if (this.menuMobileAberto()) {
      this.fecharMenuMobile();
    }
    if (this.megaMenuAberto()) {
      this.megaMenuAberto.set(false);
    }
  }

  alternarCarrinho(): void {
    this.carrinhoService.alternarGaveta();
  }

  alternarBusca(): void {
    this.buscaService.alternar();
  }

  /** Digitar no campo inline do desktop abre o overlay de busca já existente, pré-preenchido
   * com o termo — reaproveita 100% a lógica de filtro/resultados dali em vez de duplicá-la
   * num dropdown próprio. */
  atualizarBuscaInline(valor: string): void {
    this.termoBuscaInline.set(valor);
    this.buscaService.atualizarTermo(valor);
    if (!this.buscaService.aberta()) {
      this.buscaService.abrir();
    }
  }

  abrirMenuMobile(): void {
    this.menuMobileAberto.set(true);
  }

  fecharMenuMobile(): void {
    this.menuMobileAberto.set(false);
  }

  abrirMegaMenu(): void {
    if (!this.isBrowser) return;
    if (this.temporizadorFecharMegaMenu !== null) {
      clearTimeout(this.temporizadorFecharMegaMenu);
      this.temporizadorFecharMegaMenu = null;
    }
    this.megaMenuAberto.set(true);
  }

  fecharMegaMenuComAtraso(): void {
    if (!this.isBrowser) return;
    this.temporizadorFecharMegaMenu = setTimeout(() => {
      this.megaMenuAberto.set(false);
    }, ATRASO_FECHAR_MEGA_MENU_MS);
  }

  alternarMegaMenuMobile(): void {
    this.megaMenuAberto.update((atual) => !atual);
  }

  abrirWhatsapp(): void {
    const url = this.configuracaoLojaService.linkWhatsapp();
    if (url && this.isBrowser) {
      window.open(url, '_blank');
    }
  }
}
