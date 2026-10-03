import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Cupom, TipoDescontoCupom } from '../modelos/cupom.model';
import { SupabaseClienteService } from './supabase.client';

interface LinhaCupom {
  codigo: string;
  tipo_desconto: TipoDescontoCupom;
  valor_desconto: number;
  expira_em: string | null;
  ativo: boolean;
  criado_em: string;
  valor_minimo_pedido: number | null;
  limite_uso_por_email: number | null;
  categorias: string[] | null;
  produtos_ids: string[] | null;
}

function linhaParaCupom(linha: LinhaCupom): Cupom {
  return {
    codigo: linha.codigo,
    tipoDesconto: linha.tipo_desconto,
    valorDesconto: linha.valor_desconto,
    expiraEm: linha.expira_em ?? undefined,
    ativo: linha.ativo,
    criadoEm: linha.criado_em,
    valorMinimoPedido: linha.valor_minimo_pedido ?? undefined,
    limiteUsoPorEmail: linha.limite_uso_por_email ?? undefined,
    categorias: linha.categorias ?? undefined,
    produtosIds: linha.produtos_ids ?? undefined,
  };
}

export interface DadosCupom {
  codigo: string;
  tipoDesconto: TipoDescontoCupom;
  valorDesconto: number;
  expiraEm?: string;
  valorMinimoPedido?: number;
  limiteUsoPorEmail?: number;
  categorias?: string[];
  produtosIds?: string[];
}

/** CRUD de cupons — só usado em `/admin`, atrás de login (RLS restringe a tabela `cupons` a
 * admin autenticado; a validação no checkout passa por uma Edge Function à parte, ver
 * CupomService). */
@Injectable({ providedIn: 'root' })
export class AdminCupomService {
  private readonly supabaseCliente = inject(SupabaseClienteService);

  listarTodos(): Observable<Cupom[]> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('cupons')
      .select()
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as LinhaCupom[]).map(linhaParaCupom);
      });

    return from(promessa);
  }

  criar(cupom: DadosCupom): Observable<Cupom> {
    const promessa = this.supabaseCliente.obterCliente()
      .from('cupons')
      .insert({
        codigo: cupom.codigo.toUpperCase(),
        tipo_desconto: cupom.tipoDesconto,
        valor_desconto: cupom.valorDesconto,
        expira_em: cupom.expiraEm || null,
        valor_minimo_pedido: cupom.valorMinimoPedido ?? null,
        limite_uso_por_email: cupom.limiteUsoPorEmail ?? null,
        categorias: cupom.categorias?.length ? cupom.categorias : null,
        produtos_ids: cupom.produtosIds?.length ? cupom.produtosIds : null,
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
    const promessa = this.supabaseCliente.obterCliente()
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
    const promessa = this.supabaseCliente.obterCliente()
      .from('cupons')
      .delete()
      .eq('codigo', codigo)
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }
}
