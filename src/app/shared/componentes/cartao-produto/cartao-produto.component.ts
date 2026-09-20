import { Component, Input, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Produto } from '../../../core/modelos/produto.model';
import { FavoritosService } from '../../../core/servicos/favoritos.service';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';
import { MAX_PARCELAS } from '../../../core/constantes/parcelamento.constantes';

/** Estoque igual ou abaixo disso (mas maior que zero) mostra o badge "Últimas unidades". */
const ESTOQUE_BAIXO_LIMITE = 5;

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
  private readonly carrinhoService = inject(CarrinhoService);

  readonly maxParcelas = MAX_PARCELAS;

  readonly imagemPrincipal = computed(() => this.produto.imagens[0]);
  readonly imagemHover = computed(() => this.produto.imagens[1] ?? this.produto.imagens[0]);

  readonly temSegundaImagem = computed(() => this.produto.imagens.length > 1);

  readonly esgotado = computed(() =>
    this.produto.variantes.every((variante) => variante.quantidadeEstoque === 0)
  );

  /** Estoque baixo mas não esgotado — cria senso de urgência sem confundir com "Esgotado". */
  readonly estoqueBaixo = computed(
    () =>
      !this.esgotado() &&
      this.produto.variantes.some(
        (v) => v.quantidadeEstoque > 0 && v.quantidadeEstoque <= ESTOQUE_BAIXO_LIMITE
      )
  );

  readonly emPromocao = computed(() => {
    const promocional = this.produto.precoPromocional;
    return promocional != null && promocional < this.produto.precoBase;
  });

  readonly precoExibido = computed(() =>
    this.emPromocao() ? this.produto.precoPromocional! : this.produto.precoBase
  );

  readonly valorParcela = computed(() => this.precoExibido() / MAX_PARCELAS);

  /** Compra rápida só faz sentido quando não há tamanho/cor pra escolher — com mais de uma
   * variante, o cliente precisa passar pelo detalhe pra decidir qual quer. */
  readonly podeComprarRapido = computed(
    () => !this.esgotado() && this.produto.variantes.length === 1
  );

  readonly favoritado = computed(() => this.favoritosService.estaFavoritado(this.produto.id));

  alternarFavorito(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.favoritosService.alternar(this.produto);
  }

  comprarRapido(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    if (!this.podeComprarRapido()) return;
    this.carrinhoService.adicionarItem(this.produto, this.produto.variantes[0], 1);
  }
}
