import { Injectable, inject } from '@angular/core';
import { from, map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pedido } from '../modelos/pedido.model';
import { SupabaseRestService } from './supabase-rest.service';
import { obterSupabaseClient } from './supabase.client';

/** Linha da tabela `pedidos` no Supabase (snake_case, como no Postgres). */
interface LinhaPedido {
  codigo: string;
  criado_em: string;
  status: Pedido['status'];
  nome_cliente: string;
  email_cliente: string;
  telefone_cliente: string;
  endereco: Pedido['endereco'];
  itens: Pedido['itens'];
  forma_pagamento: Pedido['formaPagamento'];
  parcelas: number;
  valor_frete: number;
  valor_total: number;
}

function gerarCodigoPedido(): string {
  const sufixo = Date.now().toString(36).toUpperCase().slice(-6);
  return `VT-${sufixo}`;
}

function linhaParaPedido(linha: LinhaPedido): Pedido {
  return {
    codigo: linha.codigo,
    criadoEm: linha.criado_em,
    status: linha.status,
    nomeCliente: linha.nome_cliente,
    emailCliente: linha.email_cliente,
    telefoneCliente: linha.telefone_cliente,
    endereco: linha.endereco,
    itens: linha.itens,
    formaPagamento: linha.forma_pagamento,
    parcelas: linha.parcelas,
    valorFrete: linha.valor_frete,
    valorTotal: linha.valor_total,
  };
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly rest = inject(SupabaseRestService);

  /** Insert via REST (não pelo cliente `@supabase/supabase-js`, que sempre traz
   * GoTrue+Realtime junto e trava em Node < 22 — ver supabase-rest.service.ts). Não pede
   * `return=representation`: a role anon não tem permissão de SELECT na tabela (só admins
   * autenticados têm, ver docs/supabase/migration-002...), e pedir pro PostgREST devolver a
   * linha criada exige SELECT — sem isso o insert inteiro falha com 403. Como o cliente já
   * sabe todos os valores que mandou, o Pedido é montado localmente a partir deles. */
  criarPedido(dados: Omit<Pedido, 'codigo' | 'criadoEm' | 'status'>): Observable<Pedido> {
    const codigo = gerarCodigoPedido();
    const criadoEm = new Date().toISOString();
    const linha = {
      codigo,
      status: 'recebido' as const,
      nome_cliente: dados.nomeCliente,
      email_cliente: dados.emailCliente,
      telefone_cliente: dados.telefoneCliente,
      endereco: dados.endereco,
      itens: dados.itens,
      forma_pagamento: dados.formaPagamento,
      parcelas: dados.parcelas,
      valor_frete: dados.valorFrete,
      valor_total: dados.valorTotal,
    };

    return this.rest.insert('pedidos', linha).pipe(
      map(() => ({ ...dados, codigo, criadoEm, status: 'recebido' as const })),
      tap((pedido) => this.enviarEmailConfirmacao(pedido))
    );
  }

  /** Fire-and-forget via REST puro: falha no envio do e-mail não pode impedir o checkout de
   * concluir — o cliente já vê o link de acompanhamento na própria tela de sucesso. */
  private enviarEmailConfirmacao(pedido: Pedido): void {
    fetch(`${environment.supabaseUrl}/functions/v1/enviar-email-pedido`, {
      method: 'POST',
      headers: {
        apikey: environment.supabaseKey,
        Authorization: `Bearer ${environment.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codigo: pedido.codigo,
        emailCliente: pedido.emailCliente,
        nomeCliente: pedido.nomeCliente,
        itens: pedido.itens,
        valorTotal: pedido.valorTotal,
        urlAcompanhamento: `${environment.siteUrl}/pedido/${pedido.codigo}`,
      }),
    }).catch((erro) => console.error('Falha ao enviar e-mail de confirmação do pedido:', erro));
  }

  /** Usa a função `obter_pedido_por_codigo` (RPC) em vez de select direto na tabela — a
   * policy de select é restrita a admins autenticados, então o rastreio público por código
   * passa por essa função (SECURITY DEFINER) que só devolve o pedido pedido, sem abrir
   * leitura da tabela inteira pra quem tem a chave anônima. */
  obterPorCodigo(codigo: string): Observable<Pedido | null> {
    return this.rest
      .rpc<LinhaPedido[]>('obter_pedido_por_codigo', { p_codigo: codigo })
      .pipe(map((linhas) => (linhas.length > 0 ? linhaParaPedido(linhas[0]) : null)));
  }

  /** Usa o cliente completo (com sessão de login) — só chamado de `/admin/pedidos`, que só
   * roda no browser (nunca durante SSR), então não sofre do travamento do Realtime em Node.
   * A policy de select da tabela exige role 'authenticated', obtida da sessão logada. */
  listarTodos(): Observable<Pedido[]> {
    const promessa = obterSupabaseClient()
      .from('pedidos')
      .select()
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaPedido[]).map(linhaParaPedido);
      });

    return from(promessa);
  }

  /** Mesma observação de `listarTodos` — só roda no browser, autenticado. */
  atualizarStatus(codigo: string, status: Pedido['status']): Observable<Pedido> {
    const promessa = obterSupabaseClient()
      .from('pedidos')
      .update({ status })
      .eq('codigo', codigo)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaPedido(data as LinhaPedido);
      });

    return from(promessa);
  }
}
