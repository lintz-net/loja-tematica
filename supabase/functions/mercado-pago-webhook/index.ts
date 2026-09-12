// Recebe as notificações do Mercado Pago (configuradas no painel deles, apontando pra cá) e
// atualiza `status_pagamento` em `pedidos`. Nunca confia no status vindo do corpo da
// notificação — sempre busca o pagamento de novo na API deles (GET /v1/payments/:id) com o
// nosso access_token, que é a fonte da verdade. A página do checkout escuta a mudança via
// polling em `obter_pedido_por_codigo` (RPC pública já existente).

import { chamarMercadoPago, corsHeaders, restSupabase } from '../_shared/mercado-pago.ts';

// Secret opcional: só existe depois de cadastrar a URL do webhook no painel do Mercado Pago
// (Suas integrações → Webhooks → Chave secreta). Enquanto não configurado, seguimos sem
// validar a assinatura — mas o status nunca vem do payload em si, sempre da consulta
// autenticada à API deles, então um POST forjado não consegue aprovar pagamento nenhum, só
// nos faz reconsultar um pagamento que já existe de verdade no Mercado Pago.
const WEBHOOK_SECRET = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');

const STATUS_MP_PARA_STATUS_PAGAMENTO: Record<string, string> = {
  approved: 'aprovado',
  rejected: 'recusado',
  cancelled: 'cancelado',
  refunded: 'cancelado',
  charged_back: 'recusado',
  in_process: 'pendente',
  in_mediation: 'pendente',
  pending: 'pendente',
};

interface PagamentoMercadoPago {
  id: number;
  status: string;
  external_reference: string | null;
}

async function assinaturaValida(
  paymentId: string,
  requestId: string | null,
  xSignature: string | null
): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // sem secret configurado ainda — ver comentário acima.
  if (!requestId || !xSignature) return false;

  const partes = Object.fromEntries(
    xSignature.split(',').map((parte) => {
      const [chave, valor] = parte.split('=');
      return [chave?.trim(), valor?.trim()];
    })
  );
  const ts = partes['ts'];
  const v1 = partes['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`;

  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const assinaturaCalculada = await crypto.subtle.sign(
    'HMAC',
    chave,
    new TextEncoder().encode(manifest)
  );
  const hex = Array.from(new Uint8Array(assinaturaCalculada))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex === v1;
}

const respostaOk = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  // O Mercado Pago exige um 2xx rápido pra não ficar reenviando — sempre respondemos 200,
  // mesmo quando ignoramos a notificação (payload sem id, assinatura inválida etc.), igual ao
  // padrão já usado no webhook do Melhor Envio.
  if (req.method !== 'POST') return respostaOk();

  const url = new URL(req.url);
  const corpoBruto = await req.text();

  let payload: { type?: string; action?: string; data?: { id?: string } };
  try {
    payload = corpoBruto ? JSON.parse(corpoBruto) : {};
  } catch {
    payload = {};
  }

  // O Mercado Pago sempre manda o id do pagamento também como query string
  // (?data.id=...&type=payment) na URL configurada — usamos ela como referência oficial pra
  // validar a assinatura, com fallback pro corpo caso um dia isso mude.
  const paymentId = url.searchParams.get('data.id') ?? payload.data?.id;
  const tipo = url.searchParams.get('type') ?? payload.type ?? 'desconhecido';

  if (!paymentId || tipo !== 'payment') return respostaOk();

  const valido = await assinaturaValida(
    paymentId,
    req.headers.get('x-request-id'),
    req.headers.get('x-signature')
  );
  if (!valido) return respostaOk();

  let respostaMp: Response;
  try {
    respostaMp = await chamarMercadoPago(`/v1/payments/${paymentId}`);
  } catch (erro) {
    console.error('Falha ao consultar pagamento no Mercado Pago:', erro);
    return respostaOk();
  }
  if (!respostaMp.ok) {
    console.error(`Mercado Pago devolveu ${respostaMp.status} ao consultar pagamento ${paymentId}`);
    return respostaOk();
  }

  const pagamento = (await respostaMp.json()) as PagamentoMercadoPago;

  await restSupabase('eventos_webhook_mercado_pago', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      tipo_evento: `payment.${pagamento.status}`,
      id_pagamento_mercado_pago: String(pagamento.id),
      payload: pagamento,
    }),
  });

  const statusPagamento = STATUS_MP_PARA_STATUS_PAGAMENTO[pagamento.status];
  if (statusPagamento && pagamento.external_reference) {
    await restSupabase(
      `pedidos?codigo=eq.${encodeURIComponent(pagamento.external_reference)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status_pagamento: statusPagamento }),
      }
    );
  }

  return respostaOk();
});
