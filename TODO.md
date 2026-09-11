# TODO

## ✅ PWA (instalar como app no celular) — feito

Configurado via schematic oficial (`ng add @angular/pwa`): `@angular/service-worker`,
`ngsw-config.json` (cache padrão do schematic — app shell + assets estáticos, sem cache de
dados dinâmicos/Supabase), `public/manifest.webmanifest` e `provideServiceWorker(...)` em
`app.config.ts` (`enabled: !isDevMode()` — só ativa em build de produção).

Ícones (`public/icons/`) gerados com a marca de verdade (monograma "VN" em âmbar sobre fundo
escuro, mesma paleta do site) em vez dos ícones-padrão do Angular — gerados via `sharp`
(instalado temporariamente, não ficou como dependência). `index.html` ganhou `theme-color` e
`apple-touch-icon` (iOS não lê o manifest pra isso).

Testado: `ng build` de produção gera `ngsw-worker.js`/`ngsw.json`/`manifest.webmanifest`
corretamente; `ng serve` (dev) continua sem service worker, como esperado.

**Pendente**: testar "Adicionar à tela inicial" de verdade no celular — só dá pra validar
isso contra o site publicado (produção, HTTPS), não em `ng serve` nem numa build estática
local, porque o service worker só liga fora do modo dev.

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

**✅ Cron do `melhor-envio-refresh-token` agendado** — `docs/supabase/migration-009-agendar-crons.sql`
habilita `pg_cron`/`pg_net` e agenda o job `melhor-envio-refresh-token` (todo dia às 3h UTC,
sobra de margem pra um token que dura 30 dias). Testado disparando a chamada manualmente via
`net.http_post` e conferindo a resposta em `net._http_response`: `status_code 200`,
`{"ok":true}`.

**Pendente antes de produção**:
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

**✅ Testado contra o sandbox de verdade** (pedido de teste `VT-TESTEME`, criado via insert
direto pra não depender de pagamento real): compra completa funcionou ponta a ponta —
`status_envio` foi pra `gerado`, `id_melhor_envio` e `url_etiqueta` (link de impressão real do
sandbox) gravados certinho. Dois problemas encontrados e corrigidos durante o teste:
- **Faltava o escopo OAuth `cart-write`** (só tínhamos os `shipping-*`) — `/api/v2/me/cart`
  devolvia "This action is unauthorized". Corrigido em `melhor-envio-autorizar/index.ts`
  (adicionado `cart-read`/`cart-write` à lista de escopos) — **loja precisou ser reautorizada**
  (reautorizada com sucesso).
- **CPF/CNPJ do destinatário é obrigatório** pro Melhor Envio gerar a etiqueta, e o checkout
  não coleta esse dado do cliente. Em vez de redesenhar o checkout agora, o botão "Comprar
  etiqueta" em `/admin/pedidos` pede o documento via `window.prompt` na hora da compra
  (`comprarEtiqueta(codigo, documentoDestinatario)` na Edge Function e no `EnvioService`).
  **Dívida técnica**: o ideal continua sendo coletar CPF/CNPJ no checkout — o prompt manual é
  uma solução de curto prazo enquanto isso não existe.

### ✅ Etapa 3 — Webhook + rastreio — feito

- `supabase/functions/melhor-envio-webhook/index.ts`: recebe os eventos `order.*`, valida a
  assinatura `x-me-signature` (HMAC-SHA256 com `MELHOR_ENVIO_CLIENT_SECRET`), loga o payload
  bruto em `eventos_webhook_melhor_envio` e atualiza `status_envio`/`codigo_rastreio` em
  `envios` (casado por `id_melhor_envio`). Deployada com `--no-verify-jwt` (chamada externa,
  sem header de auth do Supabase).
- `supabase/functions/melhor-envio-rastrear-pendentes/index.ts`: fallback de polling —
  consulta `/api/v2/me/shipment/tracking` pra todo envio ainda não finalizado
  (`entregue`/`nao_entregue`/`cancelado`) e aplica a mesma atualização. Roda via Supabase Cron
  de hora em hora (ver abaixo) — não adianta chamar com mais frequência por causa do cache da
  rota.
- `EnvioService` ganhou `obterPorCodigoPedido` (RPC pública, funciona em SSR) e
  `escutarMudancas` (Realtime, só browser — guardado com `isPlatformBrowser`, mesmo padrão do
  `AuthService`, pra não travar o SSR com o `RealtimeClient` do cliente completo).
- `/pedido/:codigo` (`pedido.component.ts/html/scss`) mostra uma seção "Envio": timeline
  (criado → liberado → gerado → postado → entregue) pros status normais, aviso à parte pra
  pausado/suspenso/cancelado/não-entregue, e o código de rastreio quando disponível —
  atualiza sozinha quando o status muda, sem precisar recarregar a página.

**✅ Testado contra o sandbox de verdade** (webhook cadastrado no painel do Melhor Envio,
apontando pra `melhor-envio-webhook`). Achamos e corrigimos dois bugs reais durante o teste:
- **Cadastro do webhook falhava (E-WBH-0002, status inválido 401)** — o Melhor Envio manda uma
  requisição de teste na hora de cadastrar a URL, sem assinatura válida, e exige um 2xx pra
  aceitar. A function respondia 401 pra qualquer assinatura inválida, quebrando o cadastro.
  Corrigido: agora sempre responde 200 (`respostaOk()`), mesmo quando ignora a requisição por
  não conseguir validar a assinatura — só processa/grava algo quando a assinatura bate.
- **Todos os eventos reais chegavam mas eram descartados como "assinatura inválida"** — a
  causa raiz: o Melhor Envio manda a assinatura em **base64** no header `x-me-signature`
  (ex.: `5J1YvIYjFcdbPFoOLPus0n/D51rpSR2C1sjVciohrEY=`), e o código comparava com hexadecimal.
  Corrigido em `assinaturaValida()` (`melhor-envio-webhook/index.ts`). Confirmado com um log
  temporário de debug (já removido) que capturou as chamadas reais chegando com assinatura
  válida assim que corrigido.
- Também descoberto um evento não documentado junto dos outros: **`order.ready-to-print`**
  (aparece no sandbox entre `released` e `generated`) — mapeado pra `liberado` em
  `melhor-envio-webhook` e `melhor-envio-rastrear-pendentes`.
- Confirmado ponta a ponta: pedido de teste gerou etiqueta → webhook recebeu
  `order.created`/`order.released`/`order.ready-to-print` → `envios.status_envio` foi
  atualizado sozinho pra `liberado`, casado por `id_melhor_envio`.

**✅ Cron do `melhor-envio-rastrear-pendentes` agendado** — mesma migration acima, job de hora
em hora (`0 * * * *`, o máximo que faz sentido com o cache de 1h da rota de tracking).
Testado disparando manualmente: achou os 2 envios de teste pendentes e atualizou os dois
(`{"ok":true,"verificados":2,"atualizados":2}`).

**Pendente antes de produção**:
- Eventos como `order.received` (sem status equivalente no nosso enum `status_envio`) só ficam
  logados em `eventos_webhook_melhor_envio`, não atualizam `envios` — revisar se faz sentido
  mapear pra algum status quando isso for observado de verdade em produção.
- **Registrar o webhook de novo no app de produção** quando migrar de sandbox pra produção —
  o cadastro é por aplicativo/ambiente, não é automático.

### ✅ CPF/CNPJ do cliente coletado no checkout — feito

Fechou a dívida técnica: o checkout agora pede CPF/CNPJ na etapa de contato (validação básica
de 11 ou 14 dígitos), guardado em `pedidos.documento_cliente`
(`docs/supabase/migration-008-documento-cliente.sql`) e usado automaticamente pela
`melhor-envio-comprar-etiqueta` como documento do destinatário. O prompt manual no admin
(`window.prompt`) só aparece pra pedidos antigos, de antes dessa coluna existir, como
fallback — testado com um pedido novo já com o CPF preenchido e a compra funcionou sem pedir
nada na tela.

Pedidos de teste (`VT-TESTEME`, `VT-TESTEME2/3/4`, `VT-TESTEDOC` — criados direto via insert
REST pra testar compra de etiqueta/webhook/documento, sem passar pelo checkout) já foram
apagados (`envios` e `pedidos`), via `supabase db query --linked`.

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

**Testado e funcionando** (confirmado pelo usuário).

**Polimento feito depois** (drag-and-drop, delete real de Storage, confirmação de descarte):
- ✅ **Reordenar imagens por drag-and-drop** — `draggable` nativo do HTML nas miniaturas
  (`aoIniciarArraste`/`aoSoltarEm` em `admin-produto-form.component.ts`), sem biblioteca. A
  primeira imagem continua sendo a foto principal da listagem, a segunda a de hover.
- ✅ **Excluir imagem do Storage de verdade** — `AdminProdutoService.excluirImagem()` extrai
  o caminho a partir da URL pública e chama `storage.from('produtos').remove(...)`, disparado
  junto com a remoção do array `imagens` (fire-and-forget: falha aqui não trava o admin, só
  deixa um arquivo órfão, mesma postura de outros pontos do app).
- ✅ **Confirmação de "descartar alterações"** — novo `descartarAlteracoesGuard`
  (`CanDeactivate`, `src/app/core/guards/descartar-alteracoes.guard.ts`) aplicado nas rotas
  `admin/produtos/novo` e `admin/produtos/:id/editar`. O componente rastreia um sinal `sujo`
  via `effect()` que observa todos os campos do formulário, só passando a marcar mudança
  depois que o carregamento inicial termina (evita falso positivo ao abrir a tela de edição).
- ✅ **Shell compartilhado do admin** — `AdminShellComponent`
  (`features/admin/componentes/admin-shell/`) com barra lateral fixa (nav Pedidos/Produtos +
  botão Sair), usada como layout via rota pai `admin` (com `adminGuard` e `redirectTo:
  'pedidos'` no path vazio, então digitar só `/admin` já cai no menu) envolvendo as 4 rotas
  filhas. Cada página perdeu seu cabeçalho duplicado (título + link cruzado + botão Sair
  repetidos em cada uma) — só ficou o título e ações específicas da própria tela (ex.: "Novo
  produto"). Responsivo: vira barra horizontal no topo em telas estreitas (`max-width: 720px`).
  Ajustado depois de feedback do usuário: mais espaçamento entre os itens do menu (16px) e
  destaque mais forte no item ativo (fundo + borda + texto na cor de acento).
- `/admin/login` fica de fora do shell de propósito — não faz sentido mostrar navegação antes
  de autenticar.

**✅ Testado pelo usuário no navegador**: drag-and-drop reordenando imagens, exclusão real do
arquivo no Storage e o confirm de "descartar alterações" ao sair do formulário sem salvar —
os três funcionando.

### ✅ Guia de medidas com imagens reais (masculina/feminina) — feito

O modal "Guia de medidas" mostrava uma tabela de números inventados. Agora mostra as imagens
reais fornecidas pelo usuário (tabela ilustrada com boneco + medidas) — uma para corte
masculino/unissex, outra para feminino (baby look) — escolhida de acordo com o novo campo
`genero` do produto (`docs/supabase/migration-011-genero-produto.sql`, default `'unissex'`
pros 128 produtos antigos). Fieldset "Corte / gênero" no admin (`admin-produto-form`) deixa
escolher Unissex/Masculino/Feminino por produto.

A tabela customizada por produto (`guiaMedidas`, caso excepcional) continua existindo e tem
prioridade sobre a imagem padrão — ganhou uma coluna "Cintura" opcional no processo.

Imagens em `public/imagens/guia-medidas/` (`medidas-masculina.webp`/`medidas-feminina.webp`)
— otimizadas de ~2MB (PNG original) pra ~125KB cada via `sharp` (instalado temporariamente,
não ficou como dependência), mesma resolução (1408×768), sem perda visível de qualidade.

**✅ Testado pelo usuário**: imagem masculina aparecendo por padrão; marcando um produto como
"Feminino" no admin, a imagem feminina passou a aparecer nele.

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

## ✅ Logos de pagamento e transportadoras — feito (rodapé + checkout)

Rodapé (`RodapeComponent`) e o checkout (etapa de pagamento com cartão) mostram os logos
oficiais de verdade, baixados pelo usuário (brand center de cada bandeira, não copiados de
outro site — decisão tomada explicitamente por questão de direito de uso de marca).
Lista compartilhada em `src/app/shared/dados/logos-pagamento.ts`
(`LOGOS_PAGAMENTO` completo pro rodapé, `LOGOS_CARTAO` filtrado — sem Pix/Boleto — pro
checkout). Arquivos em `public/imagens/pagamentos/` (visa, mastercard, elo, amex, hipercard,
diners, aura, discover, boleto, pix — `.png`) e `public/imagens/envio/` (correios, jadlog,
loggi, buslog, jt-express, latam — `.webp`). Enquanto um arquivo não existir, o `(error)` no
`<img>` esconde a tag em vez de mostrar ícone de imagem quebrada — dá pra adicionar/trocar
bandeira só soltando o arquivo com o nome certo, sem mexer em código.

**✅ Testado pelo usuário**: logos aparecendo no rodapé e no checkout (etapa de pagamento com
cartão).

**✅ Logo dinâmico da transportadora — feito**: `shared/dados/logos-transportadora.ts`
exporta `LOGOS_TRANSPORTADORA` (reaproveitado pelo rodapé) e `obterLogoTransportadora(nome)`,
que casa o nome vindo dinâmico da cotação do Melhor Envio (ex.: "Jadlog") com um logo salvo
(comparação sem acento/case, `includes` em vez de igualdade exata) — sem logo pra essa
transportadora, cai pro nome em texto puro, sem quebrar nada. Usado em:
- Checkout, cada opção de frete (`checkout.component.html`) — logo ao lado do nome/prazo/preço.
- `/pedido/:codigo`, seção "Envio" (`pedido.component.html`) — nome + logo da transportadora
  escolhida, acima da timeline de status.

Testado pelo usuário nos dois lugares.

## Outros mocks/dados fixos que restam

- ~~Frete no checkout~~ — **feito**, ver seção "Integração com Melhor Envio" no topo deste
  arquivo (cotação real, compra de etiqueta e rastreio via webhook).

### ✅ `/conta` — login real de cliente (link mágico) — feito

Modelo escolhido: login por **link mágico** via Supabase Auth (mesmo mecanismo do admin,
sem senha) — sem formulário de cadastro completo. Cliente digita o e-mail em `/conta`,
recebe um link (`AuthService.entrarComLinkMagico`, `signInWithOtp`), e ao clicar volta
autenticado pra `/conta`, que passa a listar os pedidos dele
(`PedidoService.listarMeusPedidos`) e mostra a sessão real em vez do usuário fake fixo de
antes.

**⚠️ Corrigida no processo uma falha de segurança real que isso ia expor**: toda policy de
admin até aqui usava `to authenticated using (true)` — ou seja, *qualquer* usuário
autenticado no Supabase (agora incluindo clientes com login por link mágico) tinha acesso de
admin: ler todos os pedidos com dados pessoais, mudar status, criar/editar/apagar produtos e
categorias, ler `envios`/webhooks, e subir/apagar imagens no bucket `produtos`. Nunca foi
explorado porque só existia a conta do admin no projeto — mas ia virar uma vulnerabilidade
real assim que qualquer cliente criasse conta. Corrigido em
`docs/supabase/migration-010-controle-admin.sql`:
- Tabela `admins` (RLS sem nenhuma policy — só gerenciável via SQL Editor/`service_role`) +
  função `eh_admin()` (SECURITY DEFINER) que checa se `auth.uid()` está nela.
- Toda policy que usava `using (true)` pra `authenticated` (pedidos, produtos, categorias,
  envios, eventos de webhook, e os 3 policies de storage do bucket `produtos`) passou a usar
  `using (eh_admin())`.
- Nova policy em `pedidos` pra cliente comum: `lower(email_cliente) = lower(auth.jwt()->>'email')`
  — só vê os próprios pedidos, nunca a tabela toda.
- `adminGuard` (`admin.guard.ts`) também passou a chamar a RPC `eh_admin()` — antes só
  checava se existia sessão, o que teria deixado qualquer cliente logado entrar em
  `/admin/pedidos`.
- Testado: RPC `eh_admin()` com a chave anônima (sem sessão) retorna `false` sem erro;
  policies de `pedidos` conferidas via `pg_policies` mostrando `eh_admin()` no lugar de `true`.

**✅ Fluxo completo testado pelo usuário** — enviou o link mágico, clicou nele, voltou
autenticado pra `/conta` vendo o próprio e-mail, botão "Sair" e a lista real dos próprios
pedidos.

**Pendente antes de produção**: o e-mail do link mágico sai pelo serviço de e-mail **padrão do
Supabase Auth** (não pelo Resend usado pra confirmação de pedido — são dois sistemas
diferentes), que tem limite de taxa baixo e remetente/template genéricos do Supabase.
Configurar SMTP customizado (Project Settings → Auth → SMTP Settings no painel do Supabase,
pode reaproveitar o Resend) antes de operar com clientes reais.

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
