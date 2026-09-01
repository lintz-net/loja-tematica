import { Injectable, computed, inject, signal } from '@angular/core';
import { Produto } from '../modelos/produto.model';
import { CatalogoRepositorio } from './catalogo.repositorio';

const CHAVE_ARMAZENAMENTO = 'nostalgika:vistos-recentemente';
const LIMITE_VISTOS = 12;

@Injectable({ providedIn: 'root' })
export class VistosRecentementeService {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);

  /** IDs do mais recente pro mais antigo — só os IDs são persistidos, os dados completos
   * do produto (preço/estoque/imagens) são sempre reidratados do catálogo, igual ao
   * CarrinhoService e ao FavoritosService fazem. */
  private readonly idsVistos = signal<string[]>([]);
  private readonly produtosSignal = signal<Produto[]>([]);

  readonly produtosVistos = computed(() => this.produtosSignal());

  constructor() {
    this.restaurarDoArmazenamento();
  }

  registrarVisita(produto: Produto): void {
    const idsAtualizados = [produto.id, ...this.idsVistos().filter((id) => id !== produto.id)].slice(
      0,
      LIMITE_VISTOS
    );
    this.idsVistos.set(idsAtualizados);
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(idsAtualizados));

    const produtosAtualizados = [
      produto,
      ...this.produtosSignal().filter((p) => p.id !== produto.id),
    ].slice(0, LIMITE_VISTOS);
    this.produtosSignal.set(produtosAtualizados);
  }

  private restaurarDoArmazenamento(): void {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    const ids = this.parsearIds(bruto);
    if (ids.length === 0) return;

    this.idsVistos.set(ids);
    this.catalogoRepositorio.obterProdutos().subscribe((produtos) => {
      const mapa = new Map(produtos.map((produto) => [produto.id, produto]));
      this.produtosSignal.set(ids.map((id) => mapa.get(id)).filter((p): p is Produto => !!p));
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
