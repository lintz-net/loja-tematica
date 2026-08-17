import { Component, Input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Produto } from '../../../core/modelos/produto.model';

@Component({
  selector: 'app-cartao-produto',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cartao-produto.component.html',
  styleUrl: './cartao-produto.component.scss',
})
export class CartaoProdutoComponent {
  @Input({ required: true }) produto!: Produto;

  readonly imagemPrincipal = computed(() => this.produto.imagens[0]);
  readonly imagemHover = computed(() => this.produto.imagens[1] ?? this.produto.imagens[0]);

  readonly temSegundaImagem = computed(() => this.produto.imagens.length > 1);

  readonly esgotado = computed(() =>
    this.produto.variantes.every((variante) => variante.quantidadeEstoque === 0)
  );
}
