import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { obterSupabaseClient } from './supabase.client';

export type StatusEnvio =
  | 'aguardando_compra'
  | 'pendente_etiqueta'
  | 'criado'
  | 'pendente'
  | 'liberado'
  | 'gerado'
  | 'postado'
  | 'entregue'
  | 'nao_entregue'
  | 'pausado'
  | 'suspenso'
  | 'cancelado';

export interface Envio {
  id: string;
  codigoPedido: string;
  statusEnvio: StatusEnvio;
  urlEtiqueta: string | null;
  codigoRastreio: string | null;
  erroCompraEtiqueta: string | null;
}

interface LinhaEnvio {
  id: string;
  codigo_pedido: string;
  status_envio: StatusEnvio;
  url_etiqueta: string | null;
  codigo_rastreio: string | null;
  erro_compra_etiqueta: string | null;
}

function linhaParaEnvio(linha: LinhaEnvio): Envio {
  return {
    id: linha.id,
    codigoPedido: linha.codigo_pedido,
    statusEnvio: linha.status_envio,
    urlEtiqueta: linha.url_etiqueta,
    codigoRastreio: linha.codigo_rastreio,
    erroCompraEtiqueta: linha.erro_compra_etiqueta,
  };
}

/** Leitura/ação sobre envios (Melhor Envio) a partir do admin — só roda no browser,
 * autenticado (mesma observação de PedidoService.listarTodos). */
@Injectable({ providedIn: 'root' })
export class EnvioService {
  /** Um envio por pedido, indexado pelo código — usado pra cruzar com a lista de pedidos. */
  listarTodos(): Observable<Map<string, Envio>> {
    const promessa = obterSupabaseClient()
      .from('envios')
      .select()
      .then(({ data, error }) => {
        if (error) throw error;
        const linhas = data as LinhaEnvio[];
        return new Map(linhas.map((linha) => [linha.codigo_pedido, linhaParaEnvio(linha)]));
      });

    return from(promessa);
  }

  /** Dispara a compra da etiqueta via Edge Function `melhor-envio-comprar-etiqueta` — o
   * Angular nunca fala com a API do Melhor Envio diretamente. */
  async comprarEtiqueta(codigoPedido: string): Promise<{ ok: boolean; error?: string }> {
    const resposta = await fetch(
      `${environment.supabaseUrl}/functions/v1/melhor-envio-comprar-etiqueta`,
      {
        method: 'POST',
        headers: {
          apikey: environment.supabaseKey,
          Authorization: `Bearer ${environment.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codigoPedido }),
      }
    );
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      return { ok: false, error: dados.error ?? 'Falha ao comprar etiqueta.' };
    }
    return { ok: true };
  }
}
