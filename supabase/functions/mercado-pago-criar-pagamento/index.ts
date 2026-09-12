// Edge Function POST — chamada pelo checkout depois que o pedido já foi inserido em
// `pedidos` (status_pagamento 'pendente'). Cria a cobrança Pix no Mercado Pago e devolve o
// QR code pro cliente pagar; a confirmação de fato chega depois via `mercado-pago-webhook`.
// O Angular nunca fala direto com a API do Mercado Pago: o access token é secreto e só pode
// viver aqui.

import { chamarMercadoPago, corsHeaders, restSupabase } from '../_shared/mercado-pago.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

interface CorpoRequisicao {
  codigoPedido: string;
  valorTotal: number;
  emailCliente: string;
  nomeCliente: string;
  documentoCliente?: string;
}

interface RespostaPagamentoMercadoPago {
  id: number;
  status: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  date_of_expiration?: string;
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

  const { codigoPedido, valorTotal, emailCliente, nomeCliente, documentoCliente } = corpo;
  if (!codigoPedido || typeof valorTotal !== 'number' || !emailCliente || !nomeCliente) {
    return respostaJson({ error: 'Dados obrigatórios ausentes.' }, 400);
  }

  const documentoLimpo = (documentoCliente ?? '').replace(/\D/g, '');
  const identification =
    documentoLimpo.length === 11
      ? { type: 'CPF', number: documentoLimpo }
      : documentoLimpo.length === 14
        ? { type: 'CNPJ', number: documentoLimpo }
        : undefined;

  const [primeiroNome, ...resto] = nomeCliente.trim().split(/\s+/);
  const sobrenome = resto.join(' ') || primeiroNome;

  // Expira em 30 minutos — bate com o que mostramos ao cliente na tela do Pix.
  const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

  let respostaMp: Response;
  try {
    respostaMp = await chamarMercadoPago('/v1/payments', {
      method: 'POST',
      headers: {
        // Idempotency key fixa por pedido: um retry do checkout (ou clique duplo) não gera
        // uma segunda cobrança — o Mercado Pago devolve o mesmo pagamento já criado.
        'X-Idempotency-Key': codigoPedido,
      },
      body: JSON.stringify({
        transaction_amount: Math.round(valorTotal * 100) / 100,
        description: `Pedido ${codigoPedido} — Vista Nostálgica`,
        payment_method_id: 'pix',
        external_reference: codigoPedido,
        notification_url: `${SUPABASE_URL}/functions/v1/mercado-pago-webhook`,
        date_of_expiration: expiraEm.toISOString(),
        payer: {
          email: emailCliente,
          first_name: primeiroNome,
          last_name: sobrenome,
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
    console.error(`Mercado Pago recusou a criação do pagamento (${respostaMp.status}):`, detalhe);
    return respostaJson({ error: 'Não foi possível gerar o Pix.' }, 502);
  }

  const pagamento = (await respostaMp.json()) as RespostaPagamentoMercadoPago;
  const qrCode = pagamento.point_of_interaction?.transaction_data?.qr_code;
  const qrCodeBase64 = pagamento.point_of_interaction?.transaction_data?.qr_code_base64;

  if (!qrCode || !qrCodeBase64) {
    console.error('Pagamento criado sem dados de QR code Pix:', JSON.stringify(pagamento));
    return respostaJson({ error: 'Pix criado sem QR code.' }, 502);
  }

  await restSupabase(`pedidos?codigo=eq.${encodeURIComponent(codigoPedido)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id_pagamento_mercado_pago: String(pagamento.id),
      pix_qr_code: qrCode,
      pix_qr_code_base64: qrCodeBase64,
      pix_expira_em: pagamento.date_of_expiration ?? expiraEm.toISOString(),
    }),
  });

  return respostaJson({
    idPagamento: String(pagamento.id),
    qrCode,
    qrCodeBase64,
    expiraEm: pagamento.date_of_expiration ?? expiraEm.toISOString(),
  });
});
