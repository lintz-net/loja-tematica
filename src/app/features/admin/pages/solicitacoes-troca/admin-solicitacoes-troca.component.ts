import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SolicitacaoTroca, StatusSolicitacaoTroca } from '../../../../core/modelos/solicitacao-troca.model';
import { AdminSolicitacaoTrocaService } from '../../../../core/servicos/admin-solicitacao-troca.service';

const STATUS_DISPONIVEIS: StatusSolicitacaoTroca[] = [
  'pendente',
  'em_analise',
  'aprovada',
  'recusada',
  'concluida',
];

const ROTULOS_STATUS: Record<StatusSolicitacaoTroca, string> = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  concluida: 'Concluída',
};

@Component({
  selector: 'app-admin-solicitacoes-troca',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './admin-solicitacoes-troca.component.html',
  styleUrl: './admin-solicitacoes-troca.component.scss',
})
export class AdminSolicitacoesTrocaComponent {
  private readonly adminSolicitacaoTrocaService = inject(AdminSolicitacaoTrocaService);

  readonly statusDisponiveis = STATUS_DISPONIVEIS;
  readonly rotulosStatus = ROTULOS_STATUS;

  readonly carregando = signal(true);
  readonly solicitacoes = signal<SolicitacaoTroca[]>([]);
  readonly erro = signal<string | null>(null);
  readonly idSalvando = signal<string | null>(null);

  // Rascunho de resposta por solicitação (chave = id), pra não perder o texto digitado antes
  // de escolher o status e salvar — mesma ideia de um form por linha, sem precisar de
  // FormGroup pra uma tela desse tamanho.
  readonly respostasDigitadas = signal<Record<string, string>>({});

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.adminSolicitacaoTrocaService.listarTodas().subscribe({
      next: (solicitacoes) => {
        this.solicitacoes.set(solicitacoes);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as solicitações.');
        this.carregando.set(false);
      },
    });
  }

  respostaDigitada(id: string, valorAtual: string | undefined): string {
    return this.respostasDigitadas()[id] ?? valorAtual ?? '';
  }

  atualizarRespostaDigitada(id: string, valor: string): void {
    this.respostasDigitadas.update((atual) => ({ ...atual, [id]: valor }));
  }

  atualizarStatus(solicitacao: SolicitacaoTroca, status: StatusSolicitacaoTroca): void {
    this.idSalvando.set(solicitacao.id);
    this.erro.set(null);
    const resposta = this.respostaDigitada(solicitacao.id, solicitacao.respostaAdmin);

    this.adminSolicitacaoTrocaService.atualizarStatus(solicitacao.id, status, resposta).subscribe({
      next: (atualizada) => {
        this.solicitacoes.update((atual) =>
          atual.map((item) => (item.id === atualizada.id ? atualizada : item))
        );
        this.idSalvando.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível atualizar a solicitação.');
        this.idSalvando.set(null);
      },
    });
  }
}
