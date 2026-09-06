import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminProdutoService } from '../../../../core/servicos/admin-produto.service';
import { AuthService } from '../../../../core/servicos/auth.service';
import { Produto } from '../../../../core/modelos/produto.model';

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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly carregando = signal(true);
  readonly produtos = signal<Produto[]>([]);
  readonly erro = signal<string | null>(null);
  readonly excluindoId = signal<string | null>(null);

  constructor() {
    this.carregarProdutos();
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

  sair(): void {
    this.authService.sair().subscribe(() => this.router.navigate(['/admin/login']));
  }
}
