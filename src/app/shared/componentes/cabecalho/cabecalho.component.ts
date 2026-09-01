import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
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

  readonly quantidadeTotalItens = this.carrinhoService.quantidadeTotalItens;
  readonly quantidadeFavoritos = this.favoritosService.quantidadeFavoritos;

  alternarCarrinho(): void {
    this.carrinhoService.alternarGaveta();
  }

  alternarBusca(): void {
    this.buscaService.alternar();
  }
}
