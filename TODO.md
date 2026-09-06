# TODO

## ✅ Acompanhamento de pedido — feito

Implementado com Supabase (Postgres): checkout grava o pedido de verdade (`PedidoService` +
tabela `pedidos`, schema em `docs/supabase/schema.sql`) e existe uma página pública
`/pedido/:codigo` (sem login) mostrando status, itens, endereço e total — a abordagem 2 do
TODO original (link/código, sem exigir conta).

Status do pedido é `recebido` → `confirmado` → `enviado` → `entregue`, sem integração com
Correios/transportadora ainda (fase 1, como planejado).

### ✅ Painel admin pra mudar status — feito

`/admin/pedidos` (protegida por login) lista todos os pedidos e deixa mudar o status de
cada um num select. Login em `/admin/login` via Supabase Auth (`AuthService` +
`adminGuard`).

Migrações de segurança já rodadas e usuário admin já criado no Supabase:
- `docs/supabase/migration-002-admin-e-fix-rls.sql` — RLS restrita a admin + função
  `obter_pedido_por_codigo` (RPC) pro rastreio público.
- `docs/supabase/migration-003-fix-insert-policy.sql` — corrige a policy de insert, que só
  liberava a role `anon`; se o navegador estivesse com sessão de admin ativa (logado em
  `/admin/login`), o checkout quebrava com erro de RLS porque a requisição ia como
  `authenticated`, sem policy de insert pra esse papel. Agora libera insert pra `anon` e
  `authenticated`.

### ✅ E-mail de confirmação do pedido — feito

Ao finalizar o checkout, uma Supabase Edge Function (`supabase/functions/enviar-email-pedido`)
envia um e-mail de confirmação com o link de acompanhamento via Resend. Chamada fire-and-
-forget a partir de `PedidoService.criarPedido` — se falhar, não trava o checkout (o
cliente ainda vê o link "Acompanhar pedido" na tela de sucesso).

**Pendente antes de produção**: o remetente hoje é o e-mail de teste do Resend
(`onboarding@resend.dev`), que só entrega pro e-mail da própria conta Resend cadastrada —
funciona pra testar, mas não pra clientes reais. Pra isso, verificar um domínio de verdade
no Resend (registros DNS) e configurar o secret `RESEND_FROM` com o remetente final (ex.:
`Vista Nostálgica <pedidos@vistanostalgica.com.br>`).

Pendente pra depois:

- Integração real com Correios/transportadora pra mostrar rastreio de verdade (fase 2) —
  só faz sentido depois que existir processo de geração de etiqueta/código de rastreio no
  envio.

## ✅ Catálogo real (sem mock) — feito

Categorias, produtos e banners saíram do mock em memória (`catalogo.mock-data.ts`) e agora
vêm de tabelas reais no Supabase (`categorias`, `produtos`, `banners` — schema em
`docs/supabase/migration-004-catalogo.sql`). `useMock: false` em todos os `environment*.ts`.

- **Imagens continuam estáticas no repositório** (`public/imagens/produtos/<slug>/`, 256MB)
  — decisão consciente por enquanto, sem custo extra e já funcionando via CDN. Migrar pra
  Supabase Storage só faria sentido junto com uma tela de admin de produtos (não existe
  ainda — ver abaixo).
- **Sem tela de admin de produtos ainda** — pra adicionar/editar/remover produto hoje só via
  SQL direto no Supabase (as policies de `produtos`/`categorias`/`banners` só liberam
  `select`, nenhum insert/update/delete pra ninguém).
- Os 128 produtos, 6 categorias e 3 banners do mock foram migrados de uma vez via
  `scripts/gerar-seed-catalogo.ts` (rodar com `npx tsx scripts/gerar-seed-catalogo.ts`),
  que gera `docs/supabase/seed-catalogo-gerado.sql` a partir do mock — útil de referência se
  precisar reimportar ou comparar dados no futuro, mas não faz parte do fluxo normal (já
  rodado uma vez).

**Achado importante durante a migração — evitar no futuro**: o cliente completo
`@supabase/supabase-js` (`createClient`) sempre inicializa um `RealtimeClient` internamente,
mesmo sem usar canais/subscriptions, e esse cliente **trava indefinidamente** (não dá erro,
só nunca resolve) em Node < 22 ao tentar sincronizar o token de auth via WebSocket. Por isso:
- `catalogo-api.service.ts`, `banner-api.service.ts` e as operações públicas de
  `pedido.service.ts` (criar pedido, consultar por código) usam
  `supabase-rest.service.ts` — chamadas REST diretas à API do Supabase via `HttpClient`
  (não `fetch` puro: o Zone.js não rastreia `fetch` nativo no Node, o que causaria a página
  ser servida com dados vazios no SSR por uma corrida entre a serialização e a resposta).
- O cliente completo (`supabase.client.ts`, com GoTrue) só é usado por `AuthService` e pelas
  operações de admin (`listarTodos`/`atualizarStatus` em `pedido.service.ts`) — todas
  restritas a rodar só no browser (nunca durante SSR), então nunca disparam o travamento.

## Pagamento (Pix e Cartão de crédito)

PSP escolhido: **Mercado Pago**. Escopo definido: **Pix primeiro** (mais simples — sem
tokenização de cartão), cartão fica pra uma etapa seguinte.

**Bloqueado**: validação de documentos da conta já foi resolvida, mas agora a criação da
aplicação/credenciais de teste no painel de desenvolvedor do Mercado Pago está dando erro
genérico ("Ocorreu um erro. Tente novamente mais tarde") — parece instabilidade do lado
deles. Enquanto isso não resolve, este item fica parado. Ver `docs/supabase/schema.sql` —
a tabela `pedidos` já tem `forma_pagamento` e `status`, então quando o Pix for implementado
é só adicionar a etapa de geração do QR code (Edge Function do Supabase chamando a API do
Mercado Pago) e um webhook que atualiza o `status` do pedido na confirmação.

Continua valendo do planejamento original:

- **Nunca processar número de cartão no nosso próprio backend/frontend** — usar o SDK de
  tokenização do Mercado Pago quando for a vez do cartão.
- Campos hoje coletados no formulário de cartão (`numeroCartao`, `cvvCartao`, etc. em
  `checkout.component.ts`) são só simulação visual e não devem ser reaproveitados como
  estão — na integração real eles alimentam o SDK do PSP, não vão em um `POST` pro nosso
  backend.

## ✅ SSR + Open Graph — feito

Angular SSR (`@angular/ssr`) configurado. `SeoService` (`src/app/core/servicos/seo.service.ts`)
gera título, `description` e tags `og:*`/`twitter:*` dinâmicas por página (home, categoria,
produto) — preview de link no WhatsApp/Instagram/Facebook e SEO orgânico já funcionam.

**Mudança importante**: o pré-render em tempo de build (`RenderMode.Prerender`) foi
**desativado pra todas as rotas** (`angular.json`: `"prerender": false`;
`app.routes.server.ts`: tudo em `RenderMode.Server`, exceto `pedido/:codigo` e as rotas de
`admin`, que são `RenderMode.Client`). Dois motivos:
1. Os dados agora vêm de um backend real (Supabase) que muda com o tempo — pré-renderizar em
   build deixaria a página presa nos dados do momento do deploy.
2. O pré-render em build mostrou uma instabilidade não resolvida neste ambiente de
   desenvolvimento: falhas intermitentes (`{}` sem mensagem), sempre em ~1 rota entre várias,
   trocando de rota a cada tentativa, mesmo em páginas 100% estáticas sem dado nenhum — não
   foi possível identificar a causa raiz (pode ser específica deste ambiente de build/sandbox;
   vale reavaliar se o pré-render fizer falta por performance).

Toda página agora é servida via SSR por requisição (validado localmente com Node — todas as
rotas respondem 200 com HTML completo e tags corretas).

**Pendente antes de ir pra produção**:
- Marca definida como **Vista Nostálgica** (nome anterior "Nostálgika" já trocado em toda a
  loja: logo, textos, e-mails, `environment.prod.ts`, `angular.json`).
- **Domínio adiado por enquanto** — `vistanostalgica.com.br` foi escolhido (disponível pra
  registro) mas você decidiu deixar o registro/DNS pra depois, sem pressa. Quando for
  registrar: `environment.prod.ts` já está pronto com `https://vistanostalgica.com.br` (não
  precisa mexer em nada no código) — só falta registrar o domínio de verdade e apontar o
  DNS pro Netlify (guia rápido: painel do Netlify → domínio do site → Domain management →
  Add a domain, e configurar os registros que eles indicarem no lugar onde o domínio for
  registrado).
- A imagem padrão `og-padrao.jpg` referenciada em `environment.prod.ts`/`SeoService` é
  fictícia — subir uma imagem de preview de verdade antes de publicar.

### ⚠️ Ação necessária antes do próximo deploy: reconferir a Edge Function no Netlify

Antes desta mudança pro catálogo real, já tínhamos observado que a Edge Function do Angular
(`angular-ssr`, via `@netlify/angular-runtime`) não estava sendo invocada em produção
(`strong-centaur-0240eb.netlify.app`) pras rotas que não eram pré-renderizadas em build —
só as rotas estáticas (servidas direto do CDN) funcionavam; produto/categoria caíam no
fallback genérico do Netlify. Investigado sem sucesso na época: configurações de build
corretas, função aparece implantada mas com 0 invocações mesmo em tempo real, "Clear cache
and deploy" não resolveu.

**Isso importa muito mais agora**: como o pré-render em build foi desativado por completo
(seção acima) — toda rota, incluindo a home, agora depende de a Edge Function realmente
rodar. Se aquele bug do Netlify continuar, o site pode não funcionar **em nenhuma rota**
depois do próximo deploy (não testado ainda nesta configuração). Antes de fazer o próximo
deploy: testar em produção assim que subir, e se a home não carregar dados reais, considerar
recriar o site do zero no Netlify (mesmo repo) ou abrir chamado no suporte deles descrevendo
"Edge Function deployed but never invoked".

## Marketing: tráfego pago e pixels de conversão

Com SSR resolvido, falta a parte de tráfego pago em si — pixels e catálogo dinâmico:

- **Pixels de conversão** (Meta Pixel, TikTok Pixel, Google Ads tag, GA4) — precisam
  disparar em cada troca de rota (hook em `Router` → `NavigationEnd`) e mapear o evento de
  conversão real (pedido finalizado no checkout, que já existe e persiste no Supabase).
- Consentimento de cookies/LGPD pra esses pixels é obrigatório antes de carregá-los (a
  `Política de privacidade` do rodapé ainda não fala em cookies de terceiros/pixels).
- **Catálogo dinâmico de produtos** (feed pro Meta Ads, por exemplo) — SSR já dá a base
  técnica, falta gerar o feed em si.
- **Ainda em aberto (decisão de negócio)**: qual(is) plataforma(s) de tráfego pago vão
  rodar primeiro — define quais pixels instalar e se o catálogo dinâmico entra no escopo.

Recomendação: decidir as plataformas de anúncio antes de instalar qualquer pixel.
