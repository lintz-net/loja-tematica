import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Categoria e produto se beneficiam de SSR real (SEO, preview de link) — servidas sob
  // demanda a cada requisição, já que têm parâmetro e não dá pra pré-renderizar em build.
  { path: 'categoria/:slug', renderMode: RenderMode.Server },
  { path: 'produto/:slug', renderMode: RenderMode.Server },
  // Pedido (privado, sem necessidade de SEO) e admin (atrás de login) não ganham nada com
  // SSR — e forçar SSR neles chama o Supabase no servidor, que quebra (RealtimeClient exige
  // WebSocket nativo, indisponível no runtime Node usado nas functions). Client-side evita
  // o problema e é o comportamento correto pra páginas que não precisam de indexação.
  { path: 'pedido/:codigo', renderMode: RenderMode.Client },
  { path: 'admin/pedidos', renderMode: RenderMode.Client },
  { path: 'admin/login', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
