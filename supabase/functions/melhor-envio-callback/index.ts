// Edge Function GET — Redirect URI configurada no app do Melhor Envio. Recebe o `code` da
// autorização e troca por access_token/refresh_token, salvando em tokens_melhor_envio.
import { MELHOR_ENVIO_BASE_URL, salvarTokens } from '../_shared/melhor-envio.ts';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const erro = url.searchParams.get('error');

  if (erro) {
    return new Response(`Autorização negada pelo Melhor Envio: ${erro}`, { status: 400 });
  }
  if (!code) {
    return new Response('Parâmetro "code" ausente.', { status: 400 });
  }

  const clientId = Deno.env.get('MELHOR_ENVIO_CLIENT_ID');
  const clientSecret = Deno.env.get('MELHOR_ENVIO_CLIENT_SECRET');
  const redirectUri = Deno.env.get('MELHOR_ENVIO_REDIRECT_URI');

  if (!clientId || !clientSecret || !redirectUri) {
    return new Response(
      'MELHOR_ENVIO_CLIENT_ID / MELHOR_ENVIO_CLIENT_SECRET / MELHOR_ENVIO_REDIRECT_URI não configurados.',
      { status: 500 }
    );
  }

  try {
    const resposta = await fetch(`${MELHOR_ENVIO_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      return new Response(`Falha ao trocar code por token: ${corpo}`, { status: 502 });
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

    return new Response(
      '<h1>Loja autorizada com sucesso no Melhor Envio!</h1><p>Pode fechar esta aba.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (erro) {
    return new Response(`Erro inesperado: ${String(erro)}`, { status: 500 });
  }
});
