import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';
import { ItemCarrinho } from '../../../core/modelos/carrinho.model';

@Component({
  selector: 'app-carrinho-gaveta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './carrinho-gaveta.component.html',
  styleUrl: './carrinho-gaveta.component.scss',
})
export class CarrinhoGavetaComponent {
  private readonly carrinhoService = inject(CarrinhoService);

  readonly aberta = this.carrinhoService.gavetaAberta;
  readonly itens = this.carrinhoService.itensCarrinho;
  readonly valorTotal = this.carrinhoService.valorTotal;

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    if (this.aberta()) {
      this.fechar();
    }
  }

  calcularPrecoUnitario(item: ItemCarrinho): number {
    return item.variante.precoOverride ?? item.produto.precoBase;
  }

  atualizarQuantidade(varianteId: string, quantidade: number): void {
    this.carrinhoService.atualizarQuantidade(varianteId, quantidade);
  }

  removerItem(varianteId: string): void {
    this.carrinhoService.removerItem(varianteId);
  }

  fechar(): void {
    this.carrinhoService.fecharGaveta();
  }
}
