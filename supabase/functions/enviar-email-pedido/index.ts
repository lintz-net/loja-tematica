// Supabase Edge Function (Deno) — envia o e-mail de confirmação do pedido via Resend.
// Chamada pelo frontend (PedidoService) logo após o pedido ser criado no banco.
// Secret necessário: RESEND_API_KEY (configurar com `supabase secrets set`).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
/** Sem domínio verificado no Resend, só dá pra enviar usando o remetente de teste deles
 * (onboarding@resend.dev) e apenas para o e-mail da própria conta Resend. Depois que o
 * domínio da loja for verificado lá, trocar via secret RESEND_FROM (ex.:
 * 'Vista Nostálgica <pedidos@vistanostalgica.com.br>'), sem precisar reescrever a função. */
const REMETENTE = Deno.env.get('RESEND_FROM') ?? 'Vista Nostálgica <onboarding@resend.dev>';

interface ItemPedidoEmail {
  produtoNome: string;
  tamanho: string;
  cor: string;
  quantidade: number;
  precoUnitario: number;
}

interface PayloadRequisicao {
  codigo: string;
  emailCliente: string;
  nomeCliente: string;
  itens: ItemPedidoEmail[];
  valorTotal: number;
  urlAcompanhamento: string;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function montarHtml(dados: PayloadRequisicao): string {
  const linhasItens = dados.itens
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;">${item.produtoNome} — ${item.tamanho}/${item.cor} (${item.quantidade}x)</td>
          <td style="padding:8px 0; text-align:right;">${formatarMoeda(item.precoUnitario * item.quantidade)}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #241705;">
      <h1 style="font-size: 20px;">Pedido confirmado, ${dados.nomeCliente.split(' ')[0]}!</h1>
      <p>Seu pedido <strong>${dados.codigo}</strong> foi recebido com sucesso.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        ${linhasItens}
        <tr>
          <td style="padding-top:12px; font-weight:bold; border-top:1px solid #ddd;">Total</td>
          <td style="padding-top:12px; font-weight:bold; text-align:right; border-top:1px solid #ddd;">${formatarMoeda(dados.valorTotal)}</td>
        </tr>
      </table>
      <p>
        <a href="${dados.urlAcompanhamento}" style="display:inline-block; background:#ffb545; color:#241705; padding:12px 22px; border-radius:6px; text-decoration:none; font-weight:bold;">
          Acompanhar meu pedido
        </a>
      </p>
      <p style="font-size:13px; color:#5c5566;">Guarde este e-mail — o link acima é a forma de acompanhar seu pedido.</p>
    </div>
  `;
}

/** Chamada vem do navegador (origem do site) pro domínio das Edge Functions do Supabase —
 * origem cruzada, então sem esses headers o navegador bloqueia a resposta antes de ela
 * chegar ao código (e o preflight OPTIONS nem passaria). */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const dados: PayloadRequisicao = await req.json();

    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: dados.emailCliente,
        subject: `Pedido ${dados.codigo} confirmado — Vista Nostálgica`,
        html: montarHtml(dados),
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      return new Response(JSON.stringify({ error: erro }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (erro) {
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
