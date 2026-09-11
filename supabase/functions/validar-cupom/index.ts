// Edge Function POST — valida um código de cupom no checkout. A tabela `cupons` só é
// legível por admin (RLS), então essa validação passa pela service_role aqui, nunca por um
// select direto do navegador (que exporia todos os códigos/percentuais ativos pra qualquer
// um que inspecionasse a requisição).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface LinhaCupom {
  codigo: string;
  tipo_desconto: 'percentual' | 'valor_fixo';
  valor_desconto: number;
  expira_em: string | null;
  ativo: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const jsonHeaders = { ...corsHeaders(), 'Content-Type': 'application/json' };

  try {
    const { codigo, subtotal } = (await req.json()) as { codigo: string; subtotal: number };
    if (!codigo || typeof subtotal !== 'number') {
      return new Response(JSON.stringify({ valido: false, motivo: 'Dados inválidos.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const codigoNormalizado = codigo.trim().toUpperCase();

    const resposta = await fetch(
      `${SUPABASE_URL}/rest/v1/cupons?codigo=eq.${encodeURIComponent(codigoNormalizado)}&select=*`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    if (!resposta.ok) throw new Error(`Falha ao consultar cupom: ${await resposta.text()}`);

    const linhas = (await resposta.json()) as LinhaCupom[];
    const cupom = linhas[0];

    if (!cupom) {
      return new Response(JSON.stringify({ valido: false, motivo: 'Cupom não encontrado.' }), {
        headers: jsonHeaders,
      });
    }
    if (!cupom.ativo) {
      return new Response(JSON.stringify({ valido: false, motivo: 'Cupom inativo.' }), {
        headers: jsonHeaders,
      });
    }
    if (cupom.expira_em && new Date(cupom.expira_em).getTime() < Date.now()) {
      return new Response(JSON.stringify({ valido: false, motivo: 'Cupom expirado.' }), {
        headers: jsonHeaders,
      });
    }

    const descontoBruto =
      cupom.tipo_desconto === 'percentual'
        ? subtotal * (cupom.valor_desconto / 100)
        : cupom.valor_desconto;
    // Nunca desconta mais que o subtotal (evita total negativo com cupom de valor fixo alto).
    const desconto = Math.min(descontoBruto, subtotal);

    return new Response(
      JSON.stringify({
        valido: true,
        codigo: cupom.codigo,
        tipoDesconto: cupom.tipo_desconto,
        valorDesconto: cupom.valor_desconto,
        desconto,
      }),
      { headers: jsonHeaders }
    );
  } catch (erro) {
    return new Response(JSON.stringify({ valido: false, motivo: String(erro) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
