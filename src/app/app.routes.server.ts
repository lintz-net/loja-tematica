import { RenderMode, ServerRoute } from '@angular/ssr';

/** Rotas com parâmetro (categoria, produto, pedido) e as de admin (dependem de sessão do
 * navegador) não têm como ser pré-renderizadas em tempo de build — são servidas via SSR
 * sob demanda a cada requisição. Todo o resto usa prerender estático, como já era. */
export const serverRoutes: ServerRoute[] = [
  { path: 'categoria/:slug', renderMode: RenderMode.Server },
  { path: 'produto/:slug', renderMode: RenderMode.Server },
  { path: 'pedido/:codigo', renderMode: RenderMode.Server },
  { path: 'admin/pedidos', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
