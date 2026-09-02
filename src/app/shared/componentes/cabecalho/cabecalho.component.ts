import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';
import { BuscaService } from '../../../core/servicos/busca.service';
import { FavoritosService } from '../../../core/servicos/favoritos.service';

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
  private readonly router = inject(Router);

  readonly quantidadeTotalItens = this.carrinhoService.quantidadeTotalItens;
  readonly quantidadeFavoritos = this.favoritosService.quantidadeFavoritos;

  readonly menuMobileAberto = signal(false);

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
