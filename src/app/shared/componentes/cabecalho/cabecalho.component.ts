import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';
import { BuscaService } from '../../../core/servicos/busca.service';
import { FavoritosService } from '../../../core/servicos/favoritos.service';
import { ConfiguracaoLojaService } from '../../../core/servicos/configuracao-loja.service';
import { CatalogoRepositorio } from '../../../core/servicos/catalogo.repositorio';

@Component({
  selector: 'app-cabecalho',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cabecalho.component.html',
  styleUrl: './cabecalho.component.scss',
})
export class CabecalhoComponent {
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly buscaService = inject(BuscaService);
  private readonly favoritosService = inject(FavoritosService);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly router = inject(Router);

  readonly quantidadeTotalItens = this.carrinhoService.quantidadeTotalItens;
  readonly quantidadeFavoritos = this.favoritosService.quantidadeFavoritos;

  readonly menuMobileAberto = signal(false);
  readonly nomeLoja = computed(() => this.configuracaoLojaService.configuracao()?.nomeLoja ?? '');

  /** Menu de navegação vem do catálogo (banco), não é uma lista fixa de categorias — cada
   * loja tem as suas próprias. */
  readonly categorias = toSignal(this.catalogoRepositorio.obterCategorias(), { initialValue: [] });

  constructor() {
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        this.menuMobileAberto.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    if (this.menuMobileAberto()) {
      this.fecharMenuMobile();
    }
  }

  alternarCarrinho(): void {
    this.carrinhoService.alternarGaveta();
  }

  alternarBusca(): void {
    this.buscaService.alternar();
  }

  abrirMenuMobile(): void {
    this.menuMobileAberto.set(true);
  }

  fecharMenuMobile(): void {
    this.menuMobileAberto.set(false);
  }
}
