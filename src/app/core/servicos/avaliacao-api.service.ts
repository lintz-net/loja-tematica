import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Avaliacao, StatusAvaliacao } from '../modelos/avaliacao.model';
import { AvaliacaoRepositorio } from './avaliacao.repositorio';
import { SupabaseRestService } from './supabase-rest.service';

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

@Injectable()
export class AvaliacaoApiService implements AvaliacaoRepositorio {
  private readonly rest = inject(SupabaseRestService);

  obterAvaliacoesPorProduto(produtoId: string): Observable<Avaliacao[]> {
    return this.rest
      .select<LinhaAvaliacao[]>(
        'avaliacoes',
        `?select=*&produto_id=eq.${encodeURIComponent(produtoId)}&status=eq.aprovada&order=criado_em.desc`
      )
      .pipe(map((linhas) => linhas.map(linhaParaAvaliacao)));
  }

  /** Sempre 'pendente' — a RLS (migration-030-avaliacoes-publicas.sql) rejeita o insert se
   * mandarmos qualquer outro status daqui, então nem vale a pena aceitar isso como parâmetro. */
  criar(dados: {
    produtoId: string;
    nomeCliente: string;
    nota: number;
    comentario?: string;
  }): Observable<void> {
    return this.rest.insert('avaliacoes', {
      produto_id: dados.produtoId,
      nome_cliente: dados.nomeCliente,
      nota: dados.nota,
      comentario: dados.comentario || null,
      status: 'pendente',
    });
  }
}
