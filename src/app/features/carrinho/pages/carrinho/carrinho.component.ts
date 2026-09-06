import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { imagemDaVariante } from '../../../../core/utilitarios/imagem-produto.util';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './carrinho.component.html',
  styleUrl: './carrinho.component.scss',
})
export class CarrinhoComponent {
  private readonly carrinhoService = inject(CarrinhoService);

  readonly itens = this.carrinhoService.itensCarrinho;
  readonly valorTotal = this.carrinhoService.valorTotal;

  calcularPrecoUnitario(item: ReturnType<typeof this.itens>[number]): number {
    return item.variante.precoOverride ?? item.produto.precoBase;
  }

  imagemDoItem(item: ReturnType<typeof this.itens>[number]): string {
    return imagemDaVariante(item.produto, item.variante);
  }

  atualizarQuantidade(varianteId: string, quantidade: number): void {
    this.carrinhoService.atualizarQuantidade(varianteId, quantidade);
  }

  removerItem(varianteId: string): void {
    this.carrinhoService.removerItem(varianteId);
  }
}
