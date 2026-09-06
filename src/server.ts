import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { getContext } from '@netlify/angular-runtime/app-engine.js';

/** trustProxyHeaders: sem isso, o AngularAppEngine recebe o `x-forwarded-for` que o proxy
 * do Netlify sempre adiciona, não reconhece como confiável, e faz *deopt* pra CSR (serve só
 * o shell vazio, sem os dados buscados no servidor) — a home aparecia sem produtos por
 * causa disso. O proxy do Netlify é uma borda confiável, então liberar geral aqui é seguro. */
const angularAppEngine = new AngularAppEngine({ trustProxyHeaders: true });

export async function netlifyAppEngineHandler(request: Request): Promise<Response> {
  const context = getContext();
  const result = await angularAppEngine.handle(request, context);
  return result || new Response('Not found', { status: 404 });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(netlifyAppEngineHandler);
