// Fallback pro webhook (que pode falhar/atrasar): consulta periodicamente o status dos
// envios ainda não finalizados via /api/v2/me/shipment/tracking. Essa rota tem cache de 1h
// do lado do Melhor Envio, então não faz sentido chamar isso com mais frequência que isso —
// pensada pra rodar num Supabase Cron (ainda não agendado, ver TODO.md).

import { chamarMelhorEnvio, corsHeaders, restSupabase } from '../_shared/melhor-envio.ts';

const STATUS_FINAIS = ['entregue', 'nao_entregue', 'cancelado'];

const STATUS_TRACKING_PARA_STATUS_ENVIO: Record<string, string> = {
  created: 'criado',
  pending: 'pendente',
  released: 'liberado',
  generated: 'gerado',
  posted: 'postado',
  delivered: 'entregue',
  undelivered: 'nao_entregue',
  paused: 'pausado',
  suspended: 'suspenso',
  cancelled: 'cancelado',
  canceled: 'cancelado',
};

interface LinhaEnvio {
  id: string;
  id_melhor_envio: string;
}

interface ResultadoTracking {
  status?: string;
  tracking?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const filtroStatus = STATUS_FINAIS.map((s) => `status_envio.neq.${s}`).join(',');
    const envios = await restSupabase<LinhaEnvio[]>(
      `envios?select=id,id_melhor_envio&id_melhor_envio=not.is.null&and=(${filtroStatus})`
    );

    if (envios.length === 0) {
      return new Response(JSON.stringify({ ok: true, verificados: 0 }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const idsMelhorEnvio = envios.map((e) => e.id_melhor_envio);
    const respostaTracking = await chamarMelhorEnvio('/api/v2/me/shipment/tracking', {
      method: 'POST',
      body: JSON.stringify({ orders: idsMelhorEnvio }),
    });

    if (!respostaTracking.ok) {
      throw new Error(`Melhor Envio: ${await respostaTracking.text()}`);
    }

    const resultados = (await respostaTracking.json()) as Record<string, ResultadoTracking>;

    let atualizados = 0;
    for (const envio of envios) {
      const resultado = resultados[envio.id_melhor_envio];
      if (!resultado?.status) continue;

      const statusEnvio = STATUS_TRACKING_PARA_STATUS_ENVIO[resultado.status];
      if (!statusEnvio) continue;

      const atualizacao: Record<string, unknown> = {
        status_envio: statusEnvio,
        atualizado_em: new Date().toISOString(),
      };
      if (resultado.tracking) atualizacao['codigo_rastreio'] = resultado.tracking;

      await restSupabase(`envios?id=eq.${envio.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(atualizacao),
      });
      atualizados++;
    }

    return new Response(JSON.stringify({ ok: true, verificados: envios.length, atualizados }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (erro) {
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
