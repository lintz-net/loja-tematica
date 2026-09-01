import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Produto } from '../modelos/produto.model';
import { CatalogoRepositorio } from './catalogo.repositorio';

const CHAVE_ARMAZENAMENTO = 'nostalgika:favoritos';

@Injectable({ providedIn: 'root' })
export class FavoritosService {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly idsFavoritos = signal<Set<string>>(new Set());
  private carregado = false;

  readonly quantidadeFavoritos = computed(() => this.idsFavoritos().size);

  /** Lista completa dos produtos favoritados, reidratada do catálogo (preço/estoque/imagens
   * sempre atuais) — só os IDs são persistidos, igual ao CarrinhoService faz com o carrinho. */
  private readonly produtosSignal = signal<Produto[]>([]);
  readonly produtosFavoritos = computed(() => this.produtosSignal());

  constructor() {
    this.restaurarDoArmazenamento();
    effect(() => {
      const ids = this.idsFavoritos();
      if (this.carregado) {
        localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(Array.from(ids)));
      }
    });
  }

  estaFavoritado(produtoId: string): boolean {
    return this.idsFavoritos().has(produtoId);
  }

  alternar(produto: Produto): void {
    const atual = new Set(this.idsFavoritos());
    if (atual.has(produto.id)) {
      atual.delete(produto.id);
      this.produtosSignal.update((lista) => lista.filter((p) => p.id !== produto.id));
    } else {
      atual.add(produto.id);
      this.produtosSignal.update((lista) => [...lista, produto]);
    }
    this.idsFavoritos.set(atual);
  }

  remover(produtoId: string): void {
    const atual = new Set(this.idsFavoritos());
    atual.delete(produtoId);
    this.idsFavoritos.set(atual);
    this.produtosSignal.update((lista) => lista.filter((p) => p.id !== produtoId));
  }

  private restaurarDoArmazenamento(): void {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    const ids = this.parsearIds(bruto);
    if (ids.length === 0) {
      this.carregado = true;
      return;
    }

    this.idsFavoritos.set(new Set(ids));
    this.catalogoRepositorio.obterProdutos().subscribe((produtos) => {
      this.produtosSignal.set(produtos.filter((produto) => ids.includes(produto.id)));
      this.carregado = true;
    });
  }

  private parsearIds(bruto: string | null): string[] {
    if (!bruto) return [];
    try {
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
    } catch {
      return [];
    }
  }
}
