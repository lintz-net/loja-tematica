import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminProdutoService } from '../../../../core/servicos/admin-produto.service';
import { Produto } from '../../../../core/modelos/produto.model';
import { Categoria } from '../../../../core/modelos/categoria.model';

type FiltroCategoria = 'todos' | 'sem-categoria';

@Component({
  selector: 'app-admin-produtos',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './admin-produtos.component.html',
  styleUrl: './admin-produtos.component.scss',
})
export class AdminProdutosComponent {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly adminProdutoService = inject(AdminProdutoService);

  readonly carregando = signal(true);
  readonly produtos = signal<Produto[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly erro = signal<string | null>(null);
  readonly excluindoId = signal<string | null>(null);
  readonly atribuindoCategoriaId = signal<string | null>(null);

  /** "Sem categoria" — pra achar rápido os produtos que ficaram de fora na hora de mapear
   * categorias de um fornecedor pra loja (ex.: importação em lote), sem precisar abrir cada
   * produto um a um só pra descobrir quais precisam de categoria. */
  readonly filtro = signal<FiltroCategoria>('todos');

  readonly quantidadeSemCategoria = computed(
    () => this.produtos().filter((produto) => produto.categorias.length === 0).length
  );

  readonly produtosFiltrados = computed(() => {
    if (this.filtro() === 'sem-categoria') {
      return this.produtos().filter((produto) => produto.categorias.length === 0);
    }
    return this.produtos();
  });

  constructor() {
    this.carregarProdutos();
    this.catalogoRepositorio.obterCategorias().subscribe((categorias) => this.categorias.set(categorias));
  }

  private carregarProdutos(): void {
    this.carregando.set(true);
    this.catalogoRepositorio.obterProdutos().subscribe({
      next: (produtos) => {
        this.produtos.set([...produtos].sort((a, b) => a.nome.localeCompare(b.nome)));
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os produtos.');
        this.carregando.set(false);
      },
    });
  }

  /** Atribui uma categoria direto na listagem (sem abrir a tela de edição) — pensado pra
   * varrer rapidamente os produtos "Sem categoria". Sempre substitui a lista de categorias do
   * produto por essa única escolhida: um produto que já tem categoria não usa esse atalho, só
   * aparece pra quem está com a lista vazia. */
  atribuirCategoria(produto: Produto, slug: string): void {
    if (!slug) return;

    this.atribuindoCategoriaId.set(produto.id);
    this.adminProdutoService.atualizar({ ...produto, categorias: [slug] }).subscribe({
      next: (produtoAtualizado) => {
        this.produtos.update((atual) =>
          atual.map((p) => (p.id === produto.id ? produtoAtualizado : p))
        );
        this.atribuindoCategoriaId.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível atribuir a categoria a "${produto.nome}".`);
        this.atribuindoCategoriaId.set(null);
      },
    });
  }

  excluir(produto: Produto): void {
    if (!confirm(`Excluir "${produto.nome}"? Essa ação não pode ser desfeita.`)) return;

    this.excluindoId.set(produto.id);
    this.adminProdutoService.excluir(produto.id).subscribe({
      next: () => {
        this.produtos.update((atual) => atual.filter((p) => p.id !== produto.id));
        this.excluindoId.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível excluir "${produto.nome}".`);
        this.excluindoId.set(null);
      },
    });
  }
}
