import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Avaliacao } from '../../../../core/modelos/avaliacao.model';
import { Produto } from '../../../../core/modelos/produto.model';
import { AdminAvaliacaoService } from '../../../../core/servicos/admin-avaliacao.service';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-admin-avaliacoes',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-avaliacoes.component.html',
  styleUrl: './admin-avaliacoes.component.scss',
})
export class AdminAvaliacoesComponent {
  private readonly adminAvaliacaoService = inject(AdminAvaliacaoService);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);

  readonly carregando = signal(true);
  readonly avaliacoes = signal<Avaliacao[]>([]);
  readonly produtos = signal<Produto[]>([]);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly idExcluindo = signal<string | null>(null);

  // Formulário de nova avaliação
  readonly novoNomeCliente = signal('');
  readonly novaNota = signal(5);
  readonly novoComentario = signal('');
  readonly novoProdutoId = signal('');
  readonly novaData = signal(hojeIso());

  readonly podeCriar = (): boolean => this.novoNomeCliente().trim().length > 0;

  constructor() {
    this.carregar();
    this.catalogoRepositorio.obterProdutos().subscribe((produtos) => this.produtos.set(produtos));
  }

  private carregar(): void {
    this.carregando.set(true);
    this.adminAvaliacaoService.listarTodas().subscribe({
      next: (avaliacoes) => {
        this.avaliacoes.set(avaliacoes);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as avaliações.');
        this.carregando.set(false);
      },
    });
  }

  atualizarNovaNota(valor: string): void {
    this.novaNota.set(Number(valor) || 5);
  }

  nomeDoProduto(produtoId?: string | null): string {
    if (!produtoId) return '—';
    return this.produtos().find((p) => p.id === produtoId)?.nome ?? '—';
  }

  criarAvaliacao(): void {
    if (!this.podeCriar()) return;

    this.salvando.set(true);
    this.erro.set(null);
    this.adminAvaliacaoService
      .criar({
        nomeCliente: this.novoNomeCliente().trim(),
        nota: this.novaNota(),
        comentario: this.novoComentario().trim() || undefined,
        produtoId: this.novoProdutoId() || undefined,
        criadoEm: new Date(this.novaData()).toISOString(),
      })
      .subscribe({
        next: (avaliacao) => {
          this.avaliacoes.update((atual) => [avaliacao, ...atual]);
          this.salvando.set(false);
          this.novoNomeCliente.set('');
          this.novaNota.set(5);
          this.novoComentario.set('');
          this.novoProdutoId.set('');
          this.novaData.set(hojeIso());
        },
        error: () => {
          this.salvando.set(false);
          this.erro.set('Não foi possível criar a avaliação.');
        },
      });
  }

  remover(avaliacao: Avaliacao): void {
    if (!confirm('Excluir esta avaliação? Essa ação não pode ser desfeita.')) return;

    this.idExcluindo.set(avaliacao.id);
    this.adminAvaliacaoService.remover(avaliacao.id).subscribe({
      next: () => {
        this.avaliacoes.update((atual) => atual.filter((a) => a.id !== avaliacao.id));
        this.idExcluindo.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível excluir a avaliação.');
        this.idExcluindo.set(null);
      },
    });
  }
}
