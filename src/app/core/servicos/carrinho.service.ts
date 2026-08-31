import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ItemCarrinho } from '../modelos/carrinho.model';
import { Produto, VarianteProduto } from '../modelos/produto.model';
import { CatalogoRepositorio } from './catalogo.repositorio';

interface ItemCarrinhoPersistido {
  produtoId: string;
  varianteId: string;
  quantidade: number;
}

const CHAVE_ARMAZENAMENTO = 'nostalgika:carrinho';

@Injectable({ providedIn: 'root' })
export class CarrinhoService {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly itens = signal<ItemCarrinho[]>([]);
  /** Evita sobrescrever o carrinho salvo com um array vazio enquanto a restauração
   * (assíncrona, depende do catálogo) ainda não terminou. */
  private carregado = false;

  private readonly gavetaAbertaSignal = signal(false);
  readonly gavetaAberta = computed(() => this.gavetaAbertaSignal());

  readonly itensCarrinho = computed(() => this.itens());

  readonly quantidadeTotalItens = computed(() =>
    this.itens().reduce((total, item) => total + item.quantidade, 0)
  );

  readonly valorTotal = computed(() =>
    this.itens().reduce((total, item) => total + this.calcularPrecoItem(item), 0)
  );

  constructor() {
    this.restaurarDoArmazenamento();
    effect(() => {
      const itensAtuais = this.itens();
      if (this.carregado) {
        this.salvarNoArmazenamento(itensAtuais);
      }
    });
  }

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
    this.abrirGaveta();
  }

  abrirGaveta(): void {
    this.gavetaAbertaSignal.set(true);
  }

  fecharGaveta(): void {
    this.gavetaAbertaSignal.set(false);
  }

  alternarGaveta(): void {
    this.gavetaAbertaSignal.update((atual) => !atual);
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

  /** Salva só os IDs (produto/variante/quantidade) — nunca o objeto Produto inteiro, pra
   * sempre reidratar com preço, estoque e imagens atuais do catálogo, nunca uma foto antiga. */
  private salvarNoArmazenamento(itens: ItemCarrinho[]): void {
    const persistidos: ItemCarrinhoPersistido[] = itens.map((item) => ({
      produtoId: item.produto.id,
      varianteId: item.variante.id,
      quantidade: item.quantidade,
    }));
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(persistidos));
  }

  private restaurarDoArmazenamento(): void {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    const persistidos = this.parsearPersistidos(bruto);
    if (persistidos.length === 0) {
      this.carregado = true;
      return;
    }

    this.catalogoRepositorio.obterProdutos().subscribe((produtos) => {
      const itensRestaurados: ItemCarrinho[] = [];
      for (const persistido of persistidos) {
        const produto = produtos.find((p) => p.id === persistido.produtoId);
        const variante = produto?.variantes.find((v) => v.id === persistido.varianteId);
        if (produto && variante) {
          itensRestaurados.push({ produto, variante, quantidade: persistido.quantidade });
        }
      }
      this.itens.set(itensRestaurados);
      this.carregado = true;
    });
  }

  private parsearPersistidos(bruto: string | null): ItemCarrinhoPersistido[] {
    if (!bruto) return [];
    try {
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
    } catch {
      return [];
    }
  }
}
