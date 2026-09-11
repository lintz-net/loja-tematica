import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Cupom, TipoDescontoCupom } from '../modelos/cupom.model';
import { obterSupabaseClient } from './supabase.client';

interface LinhaCupom {
  codigo: string;
  tipo_desconto: TipoDescontoCupom;
  valor_desconto: number;
  expira_em: string | null;
  ativo: boolean;
  criado_em: string;
}

function linhaParaCupom(linha: LinhaCupom): Cupom {
  return {
    codigo: linha.codigo,
    tipoDesconto: linha.tipo_desconto,
    valorDesconto: linha.valor_desconto,
    expiraEm: linha.expira_em ?? undefined,
    ativo: linha.ativo,
    criadoEm: linha.criado_em,
  };
}

/** CRUD de cupons — só usado em `/admin`, atrás de login (RLS restringe a tabela `cupons` a
 * admin autenticado; a validação no checkout passa por uma Edge Function à parte, ver
 * CupomService). */
@Injectable({ providedIn: 'root' })
export class AdminCupomService {
  listarTodos(): Observable<Cupom[]> {
    const promessa = obterSupabaseClient()
      .from('cupons')
      .select()
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaCupom[]).map(linhaParaCupom);
      });

    return from(promessa);
  }

  criar(cupom: {
    codigo: string;
    tipoDesconto: TipoDescontoCupom;
    valorDesconto: number;
    expiraEm?: string;
  }): Observable<Cupom> {
    const promessa = obterSupabaseClient()
      .from('cupons')
      .insert({
        codigo: cupom.codigo.toUpperCase(),
        tipo_desconto: cupom.tipoDesconto,
        valor_desconto: cupom.valorDesconto,
        expira_em: cupom.expiraEm || null,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaCupom(data as LinhaCupom);
      });

    return from(promessa);
  }

  alternarAtivo(codigo: string, ativo: boolean): Observable<Cupom> {
    const promessa = obterSupabaseClient()
      .from('cupons')
      .update({ ativo })
      .eq('codigo', codigo)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaCupom(data as LinhaCupom);
      });

    return from(promessa);
  }

  excluir(codigo: string): Observable<void> {
    const promessa = obterSupabaseClient()
      .from('cupons')
      .delete()
      .eq('codigo', codigo)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }
}
