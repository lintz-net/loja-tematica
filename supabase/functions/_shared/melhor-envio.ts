// Utilitários compartilhados entre as Edge Functions que falam com o Melhor Envio.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente pela plataforma
// em toda Edge Function — não precisam ser configurados manualmente como secret.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** 'sandbox' por padrão — trocar pra 'producao' via secret AMBIENTE_MELHOR_ENVIO quando for
 * a hora de operar de verdade. */
export const AMBIENTE = (Deno.env.get('AMBIENTE_MELHOR_ENVIO') ?? 'sandbox') as
  | 'sandbox'
  | 'producao';

export const MELHOR_ENVIO_BASE_URL =
  AMBIENTE === 'producao'
    ? 'https://melhorenvio.com.br'
    : 'https://sandbox.melhorenvio.com.br';

/** Nome da aplicação + e-mail de contato — exigido pelo Melhor Envio no header User-Agent
 * de toda requisição à API (fora das rotas OAuth). */
const USER_AGENT =
  Deno.env.get('MELHOR_ENVIO_USER_AGENT') ?? 'Vista Nostalgica (lintz.net@gmail.com)';

interface LinhaTokenMelhorEnvio {
  ambiente: string;
  access_token: string;
  refresh_token: string;
  expira_em: string;
  atualizado_em: string;
}

export async function restSupabase<T>(
  caminho: string,
  init?: RequestInit
): Promise<T> {
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

export async function salvarTokens(dados: {
  accessToken: string;
  refreshToken: string;
  expiraEmSegundos: number;
}): Promise<void> {
  const expiraEm = new Date(Date.now() + dados.expiraEmSegundos * 1000).toISOString();
  await restSupabase('tokens_melhor_envio', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      ambiente: AMBIENTE,
      access_token: dados.accessToken,
      refresh_token: dados.refreshToken,
      expira_em: expiraEm,
      atualizado_em: new Date().toISOString(),
    }),
  });
}

async function obterLinhaToken(): Promise<LinhaTokenMelhorEnvio | null> {
  const linhas = await restSupabase<LinhaTokenMelhorEnvio[]>(
    `tokens_melhor_envio?ambiente=eq.${AMBIENTE}&select=*`
  );
  return linhas[0] ?? null;
}

async function trocarRefreshTokenPorNovoAccessToken(refreshToken: string): Promise<void> {
  const clientId = Deno.env.get('MELHOR_ENVIO_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MELHOR_ENVIO_CLIENT_SECRET')!;

  const resposta = await fetch(`${MELHOR_ENVIO_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao renovar token do Melhor Envio: ${await resposta.text()}`);
  }

  const dados = (await resposta.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await salvarTokens({
    accessToken: dados.access_token,
    refreshToken: dados.refresh_token,
    expiraEmSegundos: dados.expires_in,
  });
}

/** Devolve um access_token válido, renovando via refresh_token automaticamente se estiver
 * perto de expirar (margem de 1 dia) ou já expirado. */
export async function obterTokenValido(): Promise<string> {
  const linha = await obterLinhaToken();
  if (!linha) {
    throw new Error(
      'Nenhum token do Melhor Envio encontrado — rode a autorização OAuth primeiro (GET /melhor-envio-autorizar).'
    );
  }

  const expiraEm = new Date(linha.expira_em).getTime();
  const margemUmDiaMs = 24 * 60 * 60 * 1000;
  if (Date.now() < expiraEm - margemUmDiaMs) {
    return linha.access_token;
  }

  await trocarRefreshTokenPorNovoAccessToken(linha.refresh_token);
  const linhaAtualizada = await obterLinhaToken();
  return linhaAtualizada!.access_token;
}

/** Chama a API do Melhor Envio já com Authorization, User-Agent e Accept/Content-Type
 * corretos — usar pra toda rota que não seja OAuth. */
export async function chamarMelhorEnvio(
  caminho: string,
  init?: RequestInit
): Promise<Response> {
  const token = await obterTokenValido();
  return fetch(`${MELHOR_ENVIO_BASE_URL}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
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
