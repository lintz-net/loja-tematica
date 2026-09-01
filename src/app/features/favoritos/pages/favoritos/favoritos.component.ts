import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritosService } from '../../../../core/servicos/favoritos.service';
import { CartaoProdutoComponent } from '../../../../shared/componentes/cartao-produto/cartao-produto.component';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [RouterLink, CartaoProdutoComponent],
  templateUrl: './favoritos.component.html',
  styleUrl: './favoritos.component.scss',
})
export class FavoritosComponent {
  private readonly favoritosService = inject(FavoritosService);

  readonly produtos = this.favoritosService.produtosFavoritos;
}
