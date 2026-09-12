// Utilitários compartilhados entre as Edge Functions que falam com o Mercado Pago.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente pela plataforma
// em toda Edge Function — não precisam ser configurados manualmente como secret.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!;

export const MERCADO_PAGO_BASE_URL = 'https://api.mercadopago.com';

export async function restSupabase<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!resposta.ok) {
    throw new Error(`Supabase REST ${resposta.status}: ${await resposta.text()}`);
  }
  const texto = await resposta.text();
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

/** Chama a API do Mercado Pago já com Authorization e Content-Type corretos. */
export async function chamarMercadoPago(caminho: string, init?: RequestInit): Promise<Response> {
  return fetch(`${MERCADO_PAGO_BASE_URL}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
