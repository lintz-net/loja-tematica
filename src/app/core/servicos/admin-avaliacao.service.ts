import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Avaliacao } from '../modelos/avaliacao.model';
import { obterSupabaseClient } from './supabase.client';

interface LinhaAvaliacao {
  id: string;
  produto_id: string | null;
  nome_cliente: string;
  nota: number;
  comentario: string | null;
  criado_em: string;
}

function linhaParaAvaliacao(linha: LinhaAvaliacao): Avaliacao {
  return {
    id: linha.id,
    produtoId: linha.produto_id ?? undefined,
    nomeCliente: linha.nome_cliente,
    nota: linha.nota,
    comentario: linha.comentario ?? undefined,
    criadoEm: linha.criado_em,
  };
}

function avaliacaoParaLinha(avaliacao: Omit<Avaliacao, 'id'>): Omit<LinhaAvaliacao, 'id'> {
  return {
    produto_id: avaliacao.produtoId || null,
    nome_cliente: avaliacao.nomeCliente,
    nota: avaliacao.nota,
    comentario: avaliacao.comentario || null,
    criado_em: avaliacao.criadoEm,
  };
}

/** Cadastro manual de avaliações/depoimentos pelo admin — sem formulário público de
 * submissão. Mesmo padrão de `AdminProdutoService`/`AdminBannerService` (cliente completo do
 * Supabase, com sessão, pra satisfazer a policy restrita a admin via `eh_admin()`). */
@Injectable({ providedIn: 'root' })
export class AdminAvaliacaoService {
  listarTodas(): Observable<Avaliacao[]> {
    const promessa = obterSupabaseClient()
      .from('avaliacoes')
      .select()
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaAvaliacao[]).map(linhaParaAvaliacao);
      });

    return from(promessa);
  }

  criar(avaliacao: Omit<Avaliacao, 'id'>): Observable<Avaliacao> {
    const promessa = obterSupabaseClient()
      .from('avaliacoes')
      .insert(avaliacaoParaLinha(avaliacao))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaAvaliacao(data as LinhaAvaliacao);
      });

    return from(promessa);
  }

  atualizar(id: string, avaliacao: Omit<Avaliacao, 'id'>): Observable<Avaliacao> {
    const promessa = obterSupabaseClient()
      .from('avaliacoes')
      .update(avaliacaoParaLinha(avaliacao))
      .eq('id', id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaAvaliacao(data as LinhaAvaliacao);
      });

    return from(promessa);
  }

  remover(id: string): Observable<void> {
    const promessa = obterSupabaseClient()
      .from('avaliacoes')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }
}
