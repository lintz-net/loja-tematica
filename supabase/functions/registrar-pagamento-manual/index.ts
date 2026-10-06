// Edge Function POST — chamada pelo checkout logo depois de criar um pedido com
// formaPagamento 'manual' ("Combinar pagamento", ver ConfiguracaoLoja.aceitaPagamentoManual).
// Reserva o estoque na hora (igual o resto do catálogo, `produtos.variantes` só é
// editável por service_role — a role anon não tem policy de update), já que esse tipo de
// pedido não passa pela aprovação do Mercado Pago que dispara a baixa nos outros fluxos (ver
// baixarEstoquePedido em _shared/mercado-pago.ts, reaproveitada aqui).

import { baixarEstoquePedido, corsHeaders } from '../_shared/mercado-pago.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const jsonHeaders = { ...corsHeaders(), 'Content-Type': 'application/json' };

  try {
    const { codigoPedido } = (await req.json()) as { codigoPedido?: string };
    if (!codigoPedido) {
      return new Response(JSON.stringify({ error: 'codigoPedido obrigatório.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    await baixarEstoquePedido(codigoPedido);
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (erro) {
    console.error('Falha ao registrar pagamento manual:', erro);
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
