// Edge Function POST — cadastra o e-mail na Audience "Newsletter Vista Nostálgica" do Resend
// (criada uma vez via API, ID guardado no secret RESEND_AUDIENCE_ID). O envio de campanhas
// em si continua sendo feito manualmente pelo painel do Resend, direto pra essa audience —
// aqui só cuidamos de coletar o cadastro.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_AUDIENCE_ID = Deno.env.get('RESEND_AUDIENCE_ID')!;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const jsonHeaders = { ...corsHeaders(), 'Content-Type': 'application/json' };

  try {
    const { email } = (await req.json()) as { email: string };
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return new Response(JSON.stringify({ ok: false, erro: 'E-mail inválido.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const resposta = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      }
    );

    // Resend recusa recadastrar um e-mail já existente na audience — pro cliente, isso não é
    // um erro (ele já está inscrito), então tratamos como sucesso também.
    if (!resposta.ok) {
      const corpo = await resposta.text();
      const jaExiste = resposta.status === 409 || corpo.toLowerCase().includes('already exists');
      if (!jaExiste) {
        throw new Error(`Resend: ${corpo}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (erro) {
    return new Response(JSON.stringify({ ok: false, erro: String(erro) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
