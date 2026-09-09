// Edge Function pensada pra ser chamada por um Cron do Supabase (ex.: diariamente) —
// `obterTokenValido` já renova sozinho se o access_token estiver perto de expirar (margem
// de 1 dia), então só precisa ser invocada periodicamente pra isso acontecer mesmo sem
// nenhuma outra função ter sido chamada nesse meio tempo.
import { obterTokenValido, corsHeaders } from '../_shared/melhor-envio.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    await obterTokenValido();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (erro) {
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
