import { Injectable } from '@angular/core';
import { from, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pedido } from '../modelos/pedido.model';
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
  /** Não encadeia `.select()` depois do insert: a role anon não tem permissão de SELECT
   * na tabela (só admins autenticados têm, ver docs/supabase/migration-002...), e pedir
   * pro PostgREST devolver a linha criada exige SELECT — sem isso o insert inteiro falha
   * com 403. Como o cliente já sabe todos os valores que mandou, o Pedido é montado
   * localmente a partir deles em vez de vir de volta do banco. */
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

    const promessa = obterSupabaseClient()
      .from('pedidos')
      .insert(linha)
      .then(({ error }) => {
        if (error) throw error;
        return { ...dados, codigo, criadoEm, status: 'recebido' as const };
      });

    return from(promessa).pipe(tap((pedido) => this.enviarEmailConfirmacao(pedido)));
  }

  /** Fire-and-forget: falha no envio do e-mail não pode impedir o checkout de concluir —
   * o cliente já vê o link de acompanhamento na própria tela de sucesso.
   * `functions.invoke` não rejeita a Promise em erro HTTP — ela sempre resolve, com o erro
   * (se houver) no campo `error` do resultado — por isso o `.then` confere isso em vez de
   * confiar só num `.catch`. */
  private enviarEmailConfirmacao(pedido: Pedido): void {
    obterSupabaseClient()
      .functions.invoke('enviar-email-pedido', {
        body: {
          codigo: pedido.codigo,
          emailCliente: pedido.emailCliente,
          nomeCliente: pedido.nomeCliente,
          itens: pedido.itens,
          valorTotal: pedido.valorTotal,
          urlAcompanhamento: `${environment.siteUrl}/pedido/${pedido.codigo}`,
        },
      })
      .then(({ error }) => {
        if (error) console.error('Falha ao enviar e-mail de confirmação do pedido:', error);
      })
      .catch((erro) => console.error('Falha ao enviar e-mail de confirmação do pedido:', erro));
  }

  /** Usa a função `obter_pedido_por_codigo` (RPC) em vez de `.from('pedidos').select()`
   * direto — a policy de select da tabela é restrita a admins autenticados, então o
   * rastreio público por código passa por essa função (SECURITY DEFINER) que só devolve o
   * pedido pedido, sem abrir leitura da tabela inteira pra quem tem a chave anônima. */
  obterPorCodigo(codigo: string): Observable<Pedido | null> {
    const promessa = obterSupabaseClient()
      .rpc('obter_pedido_por_codigo', { p_codigo: codigo })
      .then(({ data, error }) => {
        if (error) throw error;
        const linhas = data as LinhaPedido[];
        return linhas.length > 0 ? linhaParaPedido(linhas[0]) : null;
      });

    return from(promessa);
  }

  /** Só funciona para um usuário autenticado (admin) — a policy de select da tabela exige
   * role 'authenticated'. */
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

  /** Só funciona para um usuário autenticado (admin) — a policy de update exige role
   * 'authenticated'. */
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
