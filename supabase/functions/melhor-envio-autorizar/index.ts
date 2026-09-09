// Edge Function GET — acessar essa URL uma vez no navegador, logado no Melhor Envio, pra
// autorizar a loja (fluxo OAuth2, feito uma única vez pelo admin, não por cliente final).
import { MELHOR_ENVIO_BASE_URL } from '../_shared/melhor-envio.ts';

Deno.serve((req: Request) => {
  const clientId = Deno.env.get('MELHOR_ENVIO_CLIENT_ID');
  const redirectUri = Deno.env.get('MELHOR_ENVIO_REDIRECT_URI');

  if (!clientId || !redirectUri) {
    return new Response('MELHOR_ENVIO_CLIENT_ID / MELHOR_ENVIO_REDIRECT_URI não configurados.', {
      status: 500,
    });
  }

  const escopos = [
    'cart-read',
    'cart-write',
    'shipping-calculate',
    'shipping-checkout',
    'shipping-generate',
    'shipping-print',
    'shipping-tracking',
    'shipping-cancel',
    'ecommerce-shipping',
  ].join(' ');

  const url = new URL(`${MELHOR_ENVIO_BASE_URL}/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', escopos);
  url.searchParams.set('state', crypto.randomUUID());

  return Response.redirect(url.toString(), 302);
});
