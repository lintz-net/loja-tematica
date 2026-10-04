// Utilitários compartilhados entre as Edge Functions que falam com o Mercado Pago.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente pela plataforma
// em toda Edge Function — não precisam ser configurados manualmente como secret.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!;

export const MERCADO_PAGO_BASE_URL = 'https://api.mercadopago.com';

export async function restSupabase<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!resposta.ok) {
    throw new Error(`Supabase REST ${resposta.status}: ${await resposta.text()}`);
  }
  const texto = await resposta.text();
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

/** Chama a API do Mercado Pago já com Authorization e Content-Type corretos. */
export async function chamarMercadoPago(caminho: string, init?: RequestInit): Promise<Response> {
  return fetch(`${MERCADO_PAGO_BASE_URL}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

/** Status de pagamento do Mercado Pago -> status_pagamento nosso (`pedidos.status_pagamento`).
 * Usado tanto na criação síncrona (cartão, resposta já vem com o status final na hora) quanto
 * no webhook (Pix, que só aprova depois, de forma assíncrona) — mesma tabela, uma fonte só. */
export const STATUS_MP_PARA_STATUS_PAGAMENTO: Record<string, string> = {
  approved: 'aprovado',
  rejected: 'recusado',
  cancelled: 'cancelado',
  refunded: 'cancelado',
  charged_back: 'recusado',
  in_process: 'pendente',
  in_mediation: 'pendente',
  pending: 'pendente',
};

/** Avança `pedidos.status` (logística: recebido/confirmado/enviado/entregue — independente
 * de `status_pagamento`) de 'recebido' pra 'confirmado' quando o pagamento é aprovado. O
 * filtro `status=eq.recebido` garante que só avança, nunca regride: se o admin já tiver
 * movido o pedido pra 'enviado'/'entregue' manualmente antes do pagamento confirmar (raro,
 * mas possível), essa chamada não bate no filtro e não faz nada. Chamado tanto pelo webhook
 * do Pix (assíncrono) quanto pela resposta síncrona do cartão. */
export async function avancarStatusParaConfirmado(codigoPedido: string): Promise<void> {
  await restSupabase(`pedidos?codigo=eq.${encodeURIComponent(codigoPedido)}&status=eq.recebido`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'confirmado' }),
  });
}

interface ItemPedidoParaEstoque {
  produtoSlug: string;
  tamanho: string;
  cor: string;
  quantidade: number;
}

interface VarianteProduto {
  id: string;
  produtoId: string;
  sku: string;
  tamanho: string;
  cor: string;
  quantidadeEstoque: number;
  precoOverride?: number;
}

/** Baixa o estoque (`produtos.variantes[].quantidadeEstoque`) de cada item do pedido quando o
 * pagamento é aprovado. `estoque_baixado` garante que isso só acontece uma vez por pedido —
 * tanto o webhook (pode notificar o mesmo pagamento mais de uma vez) quanto o pagamento por
 * cartão (confirma status na hora, síncrono) chamam essa função, e o PATCH condicional abaixo
 * (`estoque_baixado=eq.false`) funciona como uma trava: só quem conseguir virar a flag pra
 * true de fato baixa o estoque, uma segunda chamada concorrente não acha a linha e desiste.
 *
 * Busca o produto pelo slug salvo no snapshot do pedido (`produtoSlug`) e casa a variante por
 * tamanho+cor — `pedidos.itens` é só um snapshot jsonb (nome/slug/imagem/tamanho/cor), sem
 * `produtoId`/`varianteId`, então não tem join direto por id. Best-effort: se o produto ou a
 * variante não existir mais (produto excluído/variante removida desde a compra), loga e
 * continua pros outros itens — nunca falha a confirmação do pagamento por causa disso, o
 * admin sempre pode corrigir o estoque manualmente como já fazia antes dessa automação
 * existir. */
export async function baixarEstoquePedido(codigoPedido: string): Promise<void> {
  const reivindicado = await restSupabase<{ itens: ItemPedidoParaEstoque[] }[]>(
    `pedidos?codigo=eq.${encodeURIComponent(codigoPedido)}&estoque_baixado=eq.false&select=itens`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ estoque_baixado: true }),
    }
  );
  const pedido = reivindicado[0];
  if (!pedido) return; // já baixado antes (outra chamada venceu a corrida), ou pedido não existe.

  for (const item of pedido.itens) {
    try {
      const produtos = await restSupabase<{ id: string; variantes: VarianteProduto[] }[]>(
        `produtos?slug=eq.${encodeURIComponent(item.produtoSlug)}&select=id,variantes`
      );
      const produto = produtos[0];
      if (!produto) {
        console.error(`Baixa de estoque: produto "${item.produtoSlug}" não encontrado (pedido ${codigoPedido}).`);
        continue;
      }

      const variantes = produto.variantes.map((v) =>
        v.tamanho === item.tamanho && v.cor === item.cor
          ? { ...v, quantidadeEstoque: Math.max(0, v.quantidadeEstoque - item.quantidade) }
          : v
      );
      const variante = produto.variantes.find((v) => v.tamanho === item.tamanho && v.cor === item.cor);
      if (!variante) {
        console.error(
          `Baixa de estoque: variante ${item.tamanho}/${item.cor} não encontrada em "${item.produtoSlug}" (pedido ${codigoPedido}).`
        );
        continue;
      }

      await restSupabase(`produtos?id=eq.${encodeURIComponent(produto.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ variantes }),
      });
    } catch (erro) {
      console.error(`Baixa de estoque falhou pro item "${item.produtoSlug}" (pedido ${codigoPedido}):`, erro);
    }
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
