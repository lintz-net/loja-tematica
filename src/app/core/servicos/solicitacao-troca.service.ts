import { Injectable, inject } from '@angular/core';
import { from, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ItemSolicitacaoTroca,
  SolicitacaoTroca,
  StatusSolicitacaoTroca,
  TipoSolicitacaoTroca,
} from '../modelos/solicitacao-troca.model';
import { ConfiguracaoLojaService } from './configuracao-loja.service';
import { SupabaseClienteService } from './supabase.client';

interface LinhaSolicitacaoTroca {
  id: string;
  pedido_codigo: string;
  email_cliente: string;
  tipo: TipoSolicitacaoTroca;
  itens: ItemSolicitacaoTroca[];
  motivo: string;
  observacoes: string | null;
  status: StatusSolicitacaoTroca;
  resposta_admin: string | null;
  criado_em: string;
  atualizado_em: string;
}

function linhaParaSolicitacao(linha: LinhaSolicitacaoTroca): SolicitacaoTroca {
  return {
    id: linha.id,
    pedidoCodigo: linha.pedido_codigo,
    emailCliente: linha.email_cliente,
    tipo: linha.tipo,
    itens: linha.itens,
    motivo: linha.motivo,
    observacoes: linha.observacoes ?? undefined,
    status: linha.status,
    respostaAdmin: linha.resposta_admin ?? undefined,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

/** Solicitação de troca/devolução feita pelo cliente logado em `/conta` — mesmo padrão de
 * `AdminAvaliacaoService` (cliente completo do Supabase, com sessão; RLS restringe leitura e
 * escrita ao próprio e-mail da sessão, ver migration-029-solicitacoes-troca.sql). Gestão pelo
 * admin (mudar status) fica em `AdminSolicitacaoTrocaService`, não aqui. */
@Injectable({ providedIn: 'root' })
export class SolicitacaoTrocaService {
  private readonly supabaseCliente = inject(SupabaseClienteService);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);

  criar(dados: {
    pedidoCodigo: string;
    emailCliente: string;
    nomeCliente: string;
    tipo: TipoSolicitacaoTroca;
    itens: ItemSolicitacaoTroca[];
    motivo: string;
    observacoes?: string;
  }): Observable<SolicitacaoTroca> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('solicitacoes_troca')
      .insert({
        pedido_codigo: dados.pedidoCodigo,
        email_cliente: dados.emailCliente,
        tipo: dados.tipo,
        itens: dados.itens,
        motivo: dados.motivo,
        observacoes: dados.observacoes || null,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaSolicitacao(data as LinhaSolicitacaoTroca);
      });

    return from(promessa).pipe(
      tap((solicitacao) => this.notificarLoja(solicitacao, dados.nomeCliente))
    );
  }

  listarMinhas(): Observable<SolicitacaoTroca[]> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('solicitacoes_troca')
      .select()
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaSolicitacaoTroca[]).map(linhaParaSolicitacao);
      });

    return from(promessa);
  }

  /** Fire-and-forget via REST puro (mesmo padrão de `enviarEmailConfirmacao` em
   * `pedido.service.ts`) — falha no envio do e-mail não pode impedir a solicitação de ser
   * registrada, o cliente já vê a confirmação na própria tela. */
  private notificarLoja(solicitacao: SolicitacaoTroca, nomeCliente: string): void {
    const emailLoja = this.configuracaoLojaService.configuracao()?.emailContato;
    if (!emailLoja) return;

    fetch(`${environment.supabaseUrl}/functions/v1/enviar-email-solicitacao-troca`, {
      method: 'POST',
      headers: {
        apikey: environment.supabaseKey,
        Authorization: `Bearer ${environment.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailLoja,
        pedidoCodigo: solicitacao.pedidoCodigo,
        nomeCliente,
        emailCliente: solicitacao.emailCliente,
        tipo: solicitacao.tipo,
        itens: solicitacao.itens,
        motivo: solicitacao.motivo,
        observacoes: solicitacao.observacoes,
      }),
    }).catch((erro) => console.error('Falha ao notificar a loja sobre a solicitação:', erro));
  }
}
