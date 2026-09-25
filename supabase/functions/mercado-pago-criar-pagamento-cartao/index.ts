// Edge Function POST — chamada pelo checkout depois que o pedido já foi inserido em
// `pedidos` (status_pagamento 'pendente'). Cobra o cartão via token gerado pelo SDK.js do
// Mercado Pago no navegador do cliente — o número/CVV do cartão NUNCA passam por aqui nem
// por nenhum outro lugar do nosso backend, só o token (de uso único, já opaco).
//
// Diferente do Pix (mercado-pago-criar-pagamento): a resposta já vem com o status final na
// hora (approved/rejected/in_process), não precisa esperar o webhook pra saber se aprovou.
// Também por isso a X-Idempotency-Key é aleatória a cada chamada (não fixa por pedido, como
// no Pix) — o token é de uso único, então uma nova tentativa depois de recusada É uma cobrança
// nova de verdade (cartão diferente, ou mesmo cartão tentando de novo), nunca um retry do
// clique duplo. Se reaproveitássemos a idempotency key do pedido, uma segunda tentativa
// devolveria a resposta da primeira (recusada) em vez de processar o token novo.

import {
  STATUS_MP_PARA_STATUS_PAGAMENTO,
  chamarMercadoPago,
  corsHeaders,
  restSupabase,
} from '../_shared/mercado-pago.ts';

interface CorpoRequisicao {
  codigoPedido: string;
  valorTotal: number;
  emailCliente: string;
  nomeCliente: string;
  documentoCliente?: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string;
}

interface RespostaPagamentoMercadoPago {
  id: number;
  status: string;
  status_detail: string;
}

const respostaJson = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return respostaJson({ error: 'Method not allowed' }, 405);
  }

  let corpo: CorpoRequisicao;
  try {
    corpo = (await req.json()) as CorpoRequisicao;
  } catch {
    return respostaJson({ error: 'JSON inválido.' }, 400);
  }

  const {
    codigoPedido,
    valorTotal,
    emailCliente,
    nomeCliente,
    documentoCliente,
    token,
    paymentMethodId,
    issuerId,
  } = corpo;

  if (
    !codigoPedido ||
    typeof valorTotal !== 'number' ||
    !emailCliente ||
    !nomeCliente ||
    !token ||
    !paymentMethodId
  ) {
    return respostaJson({ error: 'Dados obrigatórios ausentes.' }, 400);
  }

  const documentoLimpo = (documentoCliente ?? '').replace(/\D/g, '');
  const identification =
    documentoLimpo.length === 11
      ? { type: 'CPF', number: documentoLimpo }
      : documentoLimpo.length === 14
        ? { type: 'CNPJ', number: documentoLimpo }
        : undefined;

  let respostaMp: Response;
  try {
    respostaMp = await chamarMercadoPago('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        transaction_amount: Math.round(valorTotal * 100) / 100,
        token,
        description: `Pedido ${codigoPedido} — Vista Nostálgica`,
        installments: 1, // MVP: só à vista por enquanto — parcelamento fica pra depois.
        payment_method_id: paymentMethodId,
        ...(issuerId ? { issuer_id: Number(issuerId) } : {}),
        external_reference: codigoPedido,
        payer: {
          email: emailCliente,
          ...(identification ? { identification } : {}),
        },
      }),
    });
  } catch (erro) {
    console.error('Falha ao chamar o Mercado Pago:', erro);
    return respostaJson({ error: 'Falha ao comunicar com o Mercado Pago.' }, 502);
  }

  if (!respostaMp.ok) {
    const detalhe = await respostaMp.text();
    const requestId = respostaMp.headers.get('x-request-id');
    console.error(
      `Mercado Pago recusou a criação do pagamento por cartão (${respostaMp.status}, x-request-id: ${requestId}):`,
      detalhe
    );
    return respostaJson({ error: 'Não foi possível processar o cartão.' }, 502);
  }

  const pagamento = (await respostaMp.json()) as RespostaPagamentoMercadoPago;
  const statusPagamento = STATUS_MP_PARA_STATUS_PAGAMENTO[pagamento.status] ?? 'pendente';

  await restSupabase(`pedidos?codigo=eq.${encodeURIComponent(codigoPedido)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id_pagamento_mercado_pago: String(pagamento.id),
      status_pagamento: statusPagamento,
    }),
  });

  return respostaJson({
    idPagamento: String(pagamento.id),
    status: pagamento.status,
    statusDetail: pagamento.status_detail,
  });
});
