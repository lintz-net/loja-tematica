// Recebe os eventos `order.*` do Melhor Envio (webhook cadastrado no painel deles, na mesma
// aplicação usada pra gerar as etiquetas — labels geradas por outro app não disparam aqui) e
// atualiza a tabela `envios`. A página pública de acompanhamento escuta essa tabela via
// Supabase Realtime, então a atualização aparece pro cliente sem precisar recarregar.

import { corsHeaders, restSupabase } from '../_shared/melhor-envio.ts';

const CLIENT_SECRET = Deno.env.get('MELHOR_ENVIO_CLIENT_SECRET')!;

/** Eventos `order.<sufixo>` que têm um status equivalente na coluna `status_envio` — os que
 * não aparecem aqui (ex.: `received`, sem status correspondente no nosso schema) são só
 * logados em `eventos_webhook_melhor_envio`, sem atualizar `envios`. */
const SUFIXO_PARA_STATUS_ENVIO: Record<string, string> = {
  created: 'criado',
  pending: 'pendente',
  released: 'liberado',
  'ready-to-print': 'liberado', // visto no sandbox, não documentado oficialmente junto dos outros
  generated: 'gerado',
  posted: 'postado',
  delivered: 'entregue',
  undelivered: 'nao_entregue',
  paused: 'pausado',
  suspended: 'suspenso',
  cancelled: 'cancelado',
};

interface PayloadWebhook {
  event: string;
  data: {
    id: string;
    status?: string;
    tracking?: string | null;
  };
}

async function assinaturaValida(corpoBruto: string, assinaturaRecebida: string | null): Promise<boolean> {
  if (!assinaturaRecebida) return false;

  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CLIENT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const assinaturaCalculada = await crypto.subtle.sign(
    'HMAC',
    chave,
    new TextEncoder().encode(corpoBruto)
  );
  // O Melhor Envio manda a assinatura em base64 (não hex) no header x-me-signature.
  const assinaturaBase64 = btoa(
    String.fromCharCode(...new Uint8Array(assinaturaCalculada))
  );

  return assinaturaBase64 === assinaturaRecebida;
}

const respostaOk = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  // O cadastro do webhook no painel do Melhor Envio manda uma requisição de teste (sem
  // assinatura válida, possivelmente até GET) e exige um status 2xx pra aceitar a URL —
  // por isso sempre respondemos 200 aqui, mesmo quando ignoramos a requisição por não
  // conseguir validar a assinatura. Nunca processamos/gravamos nada sem assinatura batendo.
  if (req.method !== 'POST') return respostaOk();

  const corpoBruto = await req.text();

  const assinatura = req.headers.get('x-me-signature');
  if (!(await assinaturaValida(corpoBruto, assinatura))) {
    return respostaOk();
  }

  let payload: PayloadWebhook;
  try {
    payload = JSON.parse(corpoBruto) as PayloadWebhook;
  } catch {
    return respostaOk();
  }
  const { event: evento, data } = payload;
  if (!evento) return respostaOk();

  await restSupabase('eventos_webhook_melhor_envio', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      tipo_evento: evento,
      id_melhor_envio: data?.id ?? null,
      payload: JSON.parse(corpoBruto),
    }),
  });

  const sufixo = evento.startsWith('order.') ? evento.slice('order.'.length) : null;
  const statusEnvio = sufixo ? SUFIXO_PARA_STATUS_ENVIO[sufixo] : undefined;

  if (statusEnvio && data?.id) {
    const atualizacao: Record<string, unknown> = {
      status_envio: statusEnvio,
      atualizado_em: new Date().toISOString(),
    };
    if (data.tracking) atualizacao['codigo_rastreio'] = data.tracking;

    await restSupabase(`envios?id_melhor_envio=eq.${data.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(atualizacao),
    });
  }

  return respostaOk();
});
