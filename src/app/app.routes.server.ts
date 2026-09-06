import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Home, categoria e produto mostram dados reais do catálogo (Supabase), que mudam com o
  // tempo (estoque, preço, produtos novos) — SSR sob demanda a cada requisição em vez de
  // pré-renderizar em build, senão a página fica presa nos dados do momento do último
  // deploy. Também evita problemas de estabilidade fazendo chamadas de rede durante o build.
  { path: '', renderMode: RenderMode.Server },
  { path: 'categoria/:slug', renderMode: RenderMode.Server },
  { path: 'produto/:slug', renderMode: RenderMode.Server },
  // Pedido (privado, sem necessidade de SEO) e admin (atrás de login) também não ganham
  // nada com SSR — e forçar SSR neles chama o Supabase no servidor, que pode quebrar
  // (RealtimeClient exige WebSocket nativo, indisponível em runtimes Node mais antigos).
  { path: 'pedido/:codigo', renderMode: RenderMode.Client },
  { path: 'admin/pedidos', renderMode: RenderMode.Client },
  { path: 'admin/produtos', renderMode: RenderMode.Client },
  { path: 'admin/produtos/novo', renderMode: RenderMode.Client },
  { path: 'admin/produtos/:id/editar', renderMode: RenderMode.Client },
  { path: 'admin/login', renderMode: RenderMode.Client },
  // O prerender em build mostrou instabilidade neste ambiente (falhas intermitentes e não
  // relacionadas ao conteúdo da rota, mesmo em páginas 100% estáticas). Como o SSR por
  // requisição já foi validado funcionando pra todas as rotas, tudo renderiza sob demanda —
  // perde-se o benefício de servir HTML pronto direto do CDN pras páginas institucionais,
  // mas ganha-se build confiável. Revisitar prerender aqui se a instabilidade for
  // investigada/resolvida (pode ser específica deste ambiente de build).
  { path: '**', renderMode: RenderMode.Server },
];
