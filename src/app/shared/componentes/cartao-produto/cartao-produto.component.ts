import { Component, Input, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Produto } from '../../../core/modelos/produto.model';
import { FavoritosService } from '../../../core/servicos/favoritos.service';

@Component({
  selector: 'app-cartao-produto',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cartao-produto.component.html',
  styleUrl: './cartao-produto.component.scss',
})
export class CartaoProdutoComponent {
  @Input({ required: true }) produto!: Produto;

  private readonly favoritosService = inject(FavoritosService);

  readonly imagemPrincipal = computed(() => this.produto.imagens[0]);
  readonly imagemHover = computed(() => this.produto.imagens[1] ?? this.produto.imagens[0]);

  readonly temSegundaImagem = computed(() => this.produto.imagens.length > 1);

  readonly esgotado = computed(() =>
    this.produto.variantes.every((variante) => variante.quantidadeEstoque === 0)
  );

  readonly favoritado = computed(() => this.favoritosService.estaFavoritado(this.produto.id));

  alternarFavorito(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.favoritosService.alternar(this.produto);
  }
}
