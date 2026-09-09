# TODO

## 🚧 Integração com Melhor Envio (frete/etiqueta/rastreio) — em andamento

Integração completa planejada em etapas (cotação → compra de etiqueta → rastreio). Convenção:
nomes de tabela/coluna/função em português, exceto termos técnicos da própria API do
Melhor Envio (`access_token`, `refresh_token`).

**Decisões tomadas:**
- **Ambiente**: Sandbox primeiro (`AMBIENTE_MELHOR_ENVIO` não setado = sandbox por padrão).
- **Gatilho da compra de etiqueta**: como não existe pagamento real funcionando ainda
  (Mercado Pago bloqueado), a compra será **manual pelo admin** por enquanto — vira
  automática (logo após confirmação de pagamento) quando o pagamento real existir.
- **Documento fiscal do envio (MVP)**: declaração de conteúdo (DC-e), não nota fiscal. Nota
  de risco (não é aconselhamento jurídico): DC-e é oficialmente pra envios sem fins
  comerciais — usar pra venda é solução temporária, fora das regras do Melhor Envio; revisar
  com contador antes de operar assim por muito tempo. NF-e automática e logística reversa
  ficam fora de escopo por agora.
- **Remetente**: Izac Lins, CPF 03621656456, Rua Almirante Brasil 99, Mooca, São Paulo-SP,
  CEP 03164-120 — guardado como secrets de Edge Function (`REMETENTE_*`), não como tabela.

### ✅ Etapa 1 — Schema, OAuth e cotação de frete — feito

- `docs/supabase/migration-006-melhor-envio.sql`: colunas `peso_kg`/`altura_cm`/`largura_cm`/
  `comprimento_cm` em `produtos`; tabelas `tokens_melhor_envio` (RLS sem nenhuma policy — só
  a `service_role` das Edge Functions acessa), `envios` (um por pedido, com
  `obter_envio_por_codigo_pedido` RPC pro rastreio público, e Realtime habilitado pra
  atualização automática na página de acompanhamento) e `eventos_webhook_melhor_envio` (log
  bruto dos webhooks, só admin lê).
- `docs/supabase/migration-007-frete-escolhido.sql`: colunas `frete_servico_id`/
  `frete_transportadora`/`frete_servico_nome`/`frete_prazo_dias` em `pedidos` — guarda qual
  serviço foi escolhido no checkout, necessário pra comprar a etiqueta depois.
- Edge Functions (`supabase/functions/`): `_shared/melhor-envio.ts` (helper de token
  com renovação automática via refresh_token, margem de 1 dia antes de expirar);
  `melhor-envio-autorizar` (redireciona pro fluxo OAuth — acessado uma vez pelo admin);
  `melhor-envio-callback` (troca `code` por tokens, salva no banco — Redirect URI cadastrada
  no app do Melhor Envio); `melhor-envio-refresh-token` (pensada pra Cron periódico, ainda
  **não agendada** — ver pendência abaixo); `melhor-envio-cotar` (cotação real, chamada pelo
  checkout).
- App criado no Melhor Envio Sandbox (Client ID `11826`), loja autorizada via OAuth com
  sucesso, token salvo e renovando.
- Checkout (`checkout.component.ts` + novo `frete.service.ts`) usa cotação real da Melhor
  Envio em vez das opções fixas antigas — testado com sucesso pra rotas interestaduais
  (algumas combinações de CEP no sandbox não retornam nenhuma opção — limitação dos dados de
  teste deles, não bug nosso; Correios em particular não retornou nenhuma cotação nos testes,
  mesmo aparecendo como "disponível" na conta — revisitar em produção).

**Pendente antes de produção**:
- **Agendar o Cron do `melhor-envio-refresh-token`** — hoje só existe a function, não está
  rodando periodicamente ainda. Sem isso, o token para de renovar sozinho se nenhuma outra
  function for chamada por muito tempo (o `chamarMelhorEnvio`/`obterTokenValido` também
  renova sob demanda, então na prática só afeta uso muito esporádico).
- Peso/dimensões dos 128 produtos migrados do mock estão em branco (colunas novas) — a
  cotação usa um valor padrão genérico (0,3kg, 20×5×25cm) até o admin preencher os reais.

### ✅ Etapa 2 — Compra de etiqueta — feito

- `supabase/functions/melhor-envio-comprar-etiqueta/index.ts`: recebe `codigoPedido`, busca o
  pedido e monta o pacote (carrinho → checkout/pagamento pela carteira → gerar etiqueta →
  imprimir), usando `non_commercial: true` (DC-e) em vez de nota fiscal, com
  `insurance_value` = soma dos `precoUnitario × quantidade` dos itens. Peso/dimensões vêm de
  `produtos` (fallback genérico se não preenchidos, mesma lógica da cotação).
  - Checa saldo da carteira (`GET /api/v2/me/balance`) antes de comprar, mas de forma
    *best-effort*: se o formato da resposta mudar/erro, segue e deixa o checkout real ser a
    fonte de verdade sobre saldo insuficiente.
  - Qualquer falha em qualquer etapa (carrinho/checkout/gerar) marca o envio como
    `pendente_etiqueta` com o erro salvo em `erro_compra_etiqueta`, **sem** bloquear ou
    cancelar o pedido do cliente. Sucesso grava `id_melhor_envio`, `url_etiqueta` e status
    `gerado`.
  - `_shared/melhor-envio.ts` ganhou `restSupabase` exportado (antes era interno) pra ser
    reaproveitado por essa function.
- `src/app/core/servicos/envio.service.ts` (novo): lê a tabela `envios` (autenticado, mesmo
  padrão de `PedidoService.listarTodos`) e chama a Edge Function acima.
- `/admin/pedidos` (`admin-pedidos.component.ts/html`): nova coluna "Etiqueta" mostrando o
  status do envio (rótulos em português), link "Imprimir" quando há `url_etiqueta`, e botão
  "Comprar etiqueta" — habilitado quando o pedido tem frete escolhido e o envio ainda não foi
  comprado com sucesso (permite tentar de novo em caso de `pendente_etiqueta`).

**Limitações conhecidas / dívida técnica**:
- O checkout não coleta CPF/CNPJ do cliente — o campo `document` do destinatário (`to`) vai
  vazio na chamada `/api/v2/me/cart`. Pode ser exigido pelo Melhor Envio em produção (não
  testado ainda, só sandbox); se bloquear, a compra cai em `pendente_etiqueta` com o erro
  visível no admin, sem quebrar o pedido — mas o ideal é adicionar o campo CPF ao checkout
  antes de operar em produção.
- Não testado ainda contra o ambiente sandbox de verdade (só revisado via documentação
  oficial + type-check + build limpo) — próximo passo natural é o admin clicar em "Comprar
  etiqueta" num pedido de teste e conferir o resultado.

### Próximas etapas (não iniciadas)

1. **Webhook + rastreio** — Edge Function receptora dos eventos `order.*`, atualização da
   tabela `envios` (Realtime já habilitado nela), Edge Function de polling de fallback
   (`/api/v2/me/shipment/tracking`, cache de 1h do lado deles), e a página `/pedido/:codigo`
   passa a mostrar o status do envio em tempo real via Supabase Realtime.

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

Categorias, produtos e banners saíram do mock em memória e agora vêm de tabelas reais no
Supabase (`categorias`, `produtos`, `banners` — schema em
`docs/supabase/migration-004-catalogo.sql`).

- Os 128 produtos, 6 categorias e 3 banners do mock foram migrados de uma vez via um script
  descartável (`scripts/gerar-seed-catalogo.ts`, já removido do repo depois de rodado). O
  resultado gerado (`docs/supabase/seed-catalogo-gerado.sql`) ficou como referência histórica
  caso precise reimportar ou comparar dados no futuro.
- **Limpeza feita**: removidos `catalogo-mock.service.ts`, `banner-mock.service.ts`,
  `catalogo.mock-data.ts`, `banner.mock-data.ts`, `catalogo-ozklo.manifest.ts` e a flag
  `useMock`/`apiUrl`/`mockDelayMs` dos `environment*.ts` — código morto desde que o
  catálogo passou a vir do Supabase. `app.config.ts` agora injeta
  `CatalogoApiService`/`BannerApiService` direto, sem branching.

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
  operações de admin (`listarTodos`/`atualizarStatus` em `pedido.service.ts`,
  `admin-produto.service.ts` inteiro) — todas restritas a rodar só no browser (nunca durante
  SSR), então nunca disparam o travamento.

### ✅ Gestão de produtos no admin (CRUD completo) — feito

`/admin/produtos` lista os produtos, com criar/editar/excluir (`AdminProdutoFormComponent` +
`AdminProdutoService`). Imagens migradas pro **Supabase Storage** (bucket `produtos`,
`docs/supabase/migration-005-admin-produtos.sql`) — os 128 produtos existentes tiveram suas
1006 imagens migradas via `scripts/migrar-imagens-storage.ts` (script pontual, pasta
`public/imagens/produtos` removida do repo depois, -255MB). Upload de imagem nova no
formulário sobe direto pro Storage.

Tamanho/cor no formulário usam checkboxes com listas fixas (não texto livre) + botão "Gerar
variantes" que monta a matriz tamanho×cor automaticamente — corrigido depois que o texto
livre permitiu criar uma matriz incompleta (ex.: 1 cor por tamanho) que deixava a seleção da
página de produto "travada" (botão "Adicionar ao carrinho" nunca habilitava, porque
`varianteSelecionada()` nunca achava uma variante batendo com os dois seletores).

**Testado e funcionando** (confirmado pelo usuário) — mas com melhorias pendentes que ele
quer revisitar depois (telas ainda simples):

- Reordenar imagens (hoje só entram na ordem em que foram enviadas, sem drag-and-drop).
- Excluir imagem do Storage de verdade ao remover do produto (hoje só tira do array
  `imagens`, o arquivo fica órfão no bucket).
- ✅ `imagensPorCor` (mapa cor → fotos específicas) já tem UI — seção "Fotos por cor" no
  formulário, aparece depois de marcar as cores e ter imagens enviadas. Só afeta produtos
  cadastrados/editados pelo admin daqui pra frente — os 127 produtos antigos sem esse
  de-para (só a Camiseta Donkey Kong tinha, curada manualmente antes do admin existir)
  precisam ser editados um a um se quiser adicionar isso a eles.
- `guiaMedidas` (tabela de medidas) ainda não tem UI — só dá pra editar via SQL direto.
- Sem confirmação de "descartar alterações" ao sair do formulário sem salvar.
- Geral: refinar UX/visual das telas (o próprio usuário achou "bem simples").

### ✅ Imagem do item no carrinho respeita a cor escolhida — feito

Carrinho, gaveta lateral e checkout (que grava a imagem no pedido/e-mail de confirmação)
mostravam sempre `produto.imagens[0]` — a primeira foto do produto, ignorando qual cor foi
selecionada. Criado `imagem-produto.util.ts` (`imagemDaVariante`) que usa a primeira foto de
`imagensPorCor[cor]` quando existir, com fallback pra primeira imagem geral. Só tem efeito
visível pra produtos com "Fotos por cor" preenchido no admin (ver item acima) — sem isso,
continua mostrando a foto genérica do produto, que é o único fallback possível.

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

### ✅ SSR funcionando de verdade em produção — feito

O problema anterior ("Edge Function nunca invocada") era, na real, dois bugs distintos que
faziam a Edge Function rodar mas cair pra um resultado vazio/quebrado — não a ausência de
invocação:

1. **Deopt silencioso pra CSR**: o `AngularAppEngine` recebia o header `x-forwarded-for` que
   o proxy do Netlify sempre adiciona, não reconhecia como confiável, e servia só o shell
   client-side vazio (sem os dados buscados no servidor) em vez de travar/logar um erro
   claro. Corrigido passando `trustProxyHeaders: true` no `AngularAppEngine` (`server.ts`) —
   seguro porque o proxy do Netlify é uma borda confiável.
2. **`ReferenceError: Buffer is not defined`**: o `HttpClient` do Angular usa `xhr2` como
   backend padrão no servidor, que depende de `Buffer` — indisponível no runtime **Deno**
   das Edge Functions do Netlify (Node e Deno não são a mesma coisa). Corrigido trocando pro
   backend `fetch` nativo do próprio Angular (`provideHttpClient(withFetch())` em
   `app.config.ts`), compatível com Node, Deno e browser.

Confirmado em produção (`strong-centaur-0240eb.netlify.app`): home com os 128 produtos reais,
`/produto/:slug` e `/categoria/:slug` com dados e tags `og:*` corretas.

## Outros mocks/dados fixos que restam

- **`/conta`** mostra um usuário fake fixo ("Convidado Fã de Tudo"), sem cadastro/login real
  de cliente — diferente do login de admin (`/admin/login`), que já é real. Implementar
  requer decidir o modelo (cadastro completo vs. só via Supabase Auth) — não iniciado.
- **Frete no checkout** — as opções (`OPCOES_FRETE` em `checkout.component.ts`) são valores
  fixos no código, não vêm de uma calculadora de frete real (Correios/transportadora). Junto
  seguiria a integração de rastreio real já anotada na seção de acompanhamento de pedido.

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
