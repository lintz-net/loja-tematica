import { Injectable, computed, signal } from '@angular/core';
import { ItemCarrinho } from '../modelos/carrinho.model';
import { Produto, VarianteProduto } from '../modelos/produto.model';

@Injectable({ providedIn: 'root' })
export class CarrinhoService {
  private readonly itens = signal<ItemCarrinho[]>([]);

  readonly itensCarrinho = computed(() => this.itens());

  readonly quantidadeTotalItens = computed(() =>
    this.itens().reduce((total, item) => total + item.quantidade, 0)
  );

  readonly valorTotal = computed(() =>
    this.itens().reduce((total, item) => total + this.calcularPrecoItem(item), 0)
  );

  adicionarItem(produto: Produto, variante: VarianteProduto, quantidade = 1): void {
    this.itens.update((atual) => {
      const itemExistente = atual.find((item) => item.variante.id === variante.id);
      if (itemExistente) {
        return atual.map((item) =>
          item.variante.id === variante.id
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item
        );
      }
      return [...atual, { produto, variante, quantidade }];
    });
  }

  removerItem(varianteId: string): void {
    this.itens.update((atual) => atual.filter((item) => item.variante.id !== varianteId));
  }

  atualizarQuantidade(varianteId: string, quantidade: number): void {
    if (quantidade <= 0) {
      this.removerItem(varianteId);
      return;
    }
    this.itens.update((atual) =>
      atual.map((item) => (item.variante.id === varianteId ? { ...item, quantidade } : item))
    );
  }

  limparCarrinho(): void {
    this.itens.set([]);
  }

  private calcularPrecoItem(item: ItemCarrinho): number {
    const preco = item.variante.precoOverride ?? item.produto.precoBase;
    return preco * item.quantidade;
  }
}
