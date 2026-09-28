// Supabase Edge Function (Deno) — avisa a loja (e-mail de contato configurado, não o
// cliente) que uma solicitação de troca/devolução nova chegou pelo self-service em /conta.
// Chamada pelo frontend (SolicitacaoTrocaService) logo após o insert em `solicitacoes_troca`.
// Mesmo padrão de supabase/functions/enviar-email-pedido — secret RESEND_API_KEY necessário.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const REMETENTE = Deno.env.get('RESEND_FROM') ?? 'Vista Nostálgica <onboarding@resend.dev>';

interface ItemSolicitacaoEmail {
  produtoNome: string;
  tamanho: string;
  cor: string;
  quantidade: number;
}

interface PayloadRequisicao {
  emailLoja: string;
  pedidoCodigo: string;
  nomeCliente: string;
  emailCliente: string;
  tipo: 'troca' | 'devolucao';
  itens: ItemSolicitacaoEmail[];
  motivo: string;
  observacoes?: string;
}

function montarHtml(dados: PayloadRequisicao): string {
  const rotuloTipo = dados.tipo === 'troca' ? 'Troca' : 'Devolução';
  const linhasItens = dados.itens
    .map((item) => `<li>${item.produtoNome} — ${item.tamanho}/${item.cor} (${item.quantidade}x)</li>`)
    .join('');

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #241705;">
      <h1 style="font-size: 20px;">Nova solicitação de ${rotuloTipo.toLowerCase()}</h1>
      <p>Pedido <strong>${dados.pedidoCodigo}</strong>, cliente <strong>${dados.nomeCliente}</strong> (${dados.emailCliente}).</p>
      <p><strong>Itens:</strong></p>
      <ul>${linhasItens}</ul>
      <p><strong>Motivo:</strong> ${dados.motivo}</p>
      ${dados.observacoes ? `<p><strong>Observações:</strong> ${dados.observacoes}</p>` : ''}
      <p style="font-size:13px; color:#5c5566;">Gerencie em /admin/solicitacoes-troca.</p>
    </div>
  `;
}

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
        to: dados.emailLoja,
        subject: `Solicitação de ${dados.tipo === 'troca' ? 'troca' : 'devolução'} — pedido ${dados.pedidoCodigo}`,
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
