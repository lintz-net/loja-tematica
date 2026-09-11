// Edge Function POST — chamada pelo admin ao salvar um produto cuja variante saiu de 0 pra
// algum estoque positivo. Notifica por e-mail (Resend) todo mundo que se inscreveu em
// "avise-me quando chegar" pra essa variante e marca como notificado.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const REMETENTE = Deno.env.get('RESEND_FROM') ?? 'Vista Nostálgica <onboarding@resend.dev>';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface LinhaAviso {
  id: string;
  email: string;
  produto_nome: string;
  tamanho: string;
  cor: string;
}

async function restSupabase<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!resposta.ok) throw new Error(`Supabase REST ${resposta.status}: ${await resposta.text()}`);
  const texto = await resposta.text();
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

function montarHtml(aviso: LinhaAviso, urlProduto: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #241705;">
      <h1 style="font-size: 20px;">Chegou! 🎉</h1>
      <p>
        O item <strong>${aviso.produto_nome}</strong> (${aviso.tamanho}/${aviso.cor}) que você
        pediu pra avisar já está disponível de novo.
      </p>
      <p>
        <a href="${urlProduto}" style="display:inline-block; background:#ffb545; color:#241705; padding:12px 22px; border-radius:6px; text-decoration:none; font-weight:bold;">
          Ver produto
        </a>
      </p>
    </div>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const jsonHeaders = { ...corsHeaders(), 'Content-Type': 'application/json' };

  try {
    const { varianteId, urlProduto } = (await req.json()) as {
      varianteId: string;
      urlProduto: string;
    };
    if (!varianteId || !urlProduto) {
      return new Response(JSON.stringify({ error: 'varianteId e urlProduto são obrigatórios.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const avisos = await restSupabase<LinhaAviso[]>(
      `avisos_estoque?variante_id=eq.${encodeURIComponent(varianteId)}&notificado=eq.false&select=id,email,produto_nome,tamanho,cor`
    );

    if (avisos.length === 0) {
      return new Response(JSON.stringify({ notificados: 0 }), { headers: jsonHeaders });
    }

    let notificados = 0;
    for (const aviso of avisos) {
      const respostaEmail = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: REMETENTE,
          to: aviso.email,
          subject: `${aviso.produto_nome} está de volta! — Vista Nostálgica`,
          html: montarHtml(aviso, urlProduto),
        }),
      });

      if (respostaEmail.ok) {
        await restSupabase(`avisos_estoque?id=eq.${aviso.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ notificado: true, notificado_em: new Date().toISOString() }),
        });
        notificados++;
      }
    }

    return new Response(JSON.stringify({ notificados }), { headers: jsonHeaders });
  } catch (erro) {
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
