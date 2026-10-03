import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Avaliacao, StatusAvaliacao } from '../modelos/avaliacao.model';
import { SupabaseClienteService } from './supabase.client';

interface LinhaAvaliacao {
  id: string;
  produto_id: string | null;
  nome_cliente: string;
  nota: number;
  comentario: string | null;
  criado_em: string;
  status: StatusAvaliacao;
}

function linhaParaAvaliacao(linha: LinhaAvaliacao): Avaliacao {
  return {
    id: linha.id,
    produtoId: linha.produto_id ?? undefined,
    nomeCliente: linha.nome_cliente,
    nota: linha.nota,
    comentario: linha.comentario ?? undefined,
    criadoEm: linha.criado_em,
    status: linha.status,
  };
}

function avaliacaoParaLinha(avaliacao: Omit<Avaliacao, 'id'>): Omit<LinhaAvaliacao, 'id'> {
  return {
    produto_id: avaliacao.produtoId || null,
    nome_cliente: avaliacao.nomeCliente,
    nota: avaliacao.nota,
    comentario: avaliacao.comentario || null,
    criado_em: avaliacao.criadoEm,
    status: avaliacao.status,
  };
}

/** Cadastro manual de avaliações/depoimentos pelo admin (sempre nasce 'aprovada', ver
 * `criar()`) + moderação das avaliações públicas que chegam 'pendente' (ver
 * `AvaliacaoApiService.criar`, usado em `/produto/:slug`). Mesmo padrão de
 * `AdminProdutoService`/`AdminBannerService` (cliente completo do Supabase, com sessão, pra
 * satisfazer a policy restrita a admin via `eh_admin()`). */
@Injectable({ providedIn: 'root' })
export class AdminAvaliacaoService {
  private readonly supabaseCliente = inject(SupabaseClienteService);

  listarTodas(): Observable<Avaliacao[]> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('avaliacoes')
      .select()
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaAvaliacao[]).map(linhaParaAvaliacao);
      });

    return from(promessa);
  }

  /** Cadastro manual — sempre 'aprovada' na hora (é o admin digitando, não precisa moderar a
   * própria avaliação). */
  criar(avaliacao: Omit<Avaliacao, 'id' | 'status'>): Observable<Avaliacao> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('avaliacoes')
      .insert(avaliacaoParaLinha({ ...avaliacao, status: 'aprovada' }))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaAvaliacao(data as LinhaAvaliacao);
      });

    return from(promessa);
  }

  atualizar(id: string, avaliacao: Omit<Avaliacao, 'id'>): Observable<Avaliacao> {
    const promessa = this.supabaseCliente.obterCliente()
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

  /** Aprovar/rejeitar uma avaliação pendente — moderação, ver `/admin/avaliacoes`. */
  atualizarStatus(id: string, status: StatusAvaliacao): Observable<Avaliacao> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('avaliacoes')
      .update({ status })
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
    const promessa = this.supabaseCliente.obterCliente()
      .from('avaliacoes')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }
}
