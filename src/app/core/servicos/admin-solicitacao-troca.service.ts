import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import {
  ItemSolicitacaoTroca,
  SolicitacaoTroca,
  StatusSolicitacaoTroca,
  TipoSolicitacaoTroca,
} from '../modelos/solicitacao-troca.model';
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

/** Gestão (admin) das solicitações de troca/devolução — só roda em `/admin`, autenticado como
 * admin (`eh_admin()`, ver migration-029-solicitacoes-troca.sql). Mesmo padrão de
 * `AdminAvaliacaoService`. */
@Injectable({ providedIn: 'root' })
export class AdminSolicitacaoTrocaService {
  private readonly supabaseCliente = inject(SupabaseClienteService);

  listarTodas(): Observable<SolicitacaoTroca[]> {
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

  atualizarStatus(
    id: string,
    status: StatusSolicitacaoTroca,
    respostaAdmin?: string
  ): Observable<SolicitacaoTroca> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('solicitacoes_troca')
      .update({
        status,
        resposta_admin: respostaAdmin || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaSolicitacao(data as LinhaSolicitacaoTroca);
      });

    return from(promessa);
  }
}
