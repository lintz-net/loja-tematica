import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Avaliacao, StatusAvaliacao } from '../../../../core/modelos/avaliacao.model';
import { Produto } from '../../../../core/modelos/produto.model';
import { AdminAvaliacaoService } from '../../../../core/servicos/admin-avaliacao.service';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const FILTROS: Array<StatusAvaliacao | 'todas'> = ['pendente', 'aprovada', 'rejeitada', 'todas'];

const ROTULOS_FILTRO: Record<StatusAvaliacao | 'todas', string> = {
  pendente: 'Pendentes',
  aprovada: 'Aprovadas',
  rejeitada: 'Rejeitadas',
  todas: 'Todas',
};

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

  readonly filtros = FILTROS;
  readonly rotulosFiltro = ROTULOS_FILTRO;

  readonly carregando = signal(true);
  readonly avaliacoes = signal<Avaliacao[]>([]);
  readonly produtos = signal<Produto[]>([]);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly idExcluindo = signal<string | null>(null);
  readonly idModerando = signal<string | null>(null);

  /** Pendente é o filtro padrão — é o que o admin precisa ver primeiro pra moderar; as outras
   * já estão "resolvidas". */
  readonly filtroStatus = signal<StatusAvaliacao | 'todas'>('pendente');

  readonly quantidadePendentes = computed(
    () => this.avaliacoes().filter((a) => a.status === 'pendente').length
  );

  readonly avaliacoesFiltradas = computed(() => {
    const filtro = this.filtroStatus();
    if (filtro === 'todas') return this.avaliacoes();
    return this.avaliacoes().filter((a) => a.status === filtro);
  });

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

  moderar(avaliacao: Avaliacao, status: StatusAvaliacao): void {
    this.idModerando.set(avaliacao.id);
    this.erro.set(null);
    this.adminAvaliacaoService.atualizarStatus(avaliacao.id, status).subscribe({
      next: (atualizada) => {
        this.avaliacoes.update((atual) => atual.map((a) => (a.id === atualizada.id ? atualizada : a)));
        this.idModerando.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível atualizar a avaliação.');
        this.idModerando.set(null);
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
