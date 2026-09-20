import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Avaliacao } from '../modelos/avaliacao.model';
import { AvaliacaoRepositorio } from './avaliacao.repositorio';
import { SupabaseRestService } from './supabase-rest.service';

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

@Injectable()
export class AvaliacaoApiService implements AvaliacaoRepositorio {
  private readonly rest = inject(SupabaseRestService);

  obterAvaliacoesPorProduto(produtoId: string): Observable<Avaliacao[]> {
    return this.rest
      .select<LinhaAvaliacao[]>(
        'avaliacoes',
        `?select=*&produto_id=eq.${encodeURIComponent(produtoId)}&order=criado_em.desc`
      )
      .pipe(map((linhas) => linhas.map(linhaParaAvaliacao)));
  }
}
