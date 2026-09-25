# TODO

## 🔴 Bloqueadores pra produção

- ~~**Pagamento real (Mercado Pago)**~~ — **resolvido em 2026-09-22**. Backend completo:
  migration (`status_pagamento`, `eventos_webhook_mercado_pago`), Edge Functions
  `mercado-pago-criar-pagamento`/`mercado-pago-webhook`, checkout com tela de QR code Pix +
  polling até aprovação. O `403 Payer email forbidden` reportado no chamado era esperado: o
  suporte do Mercado Pago confirmou que `payer.email` de um usuário de teste
  (`POST /users/test_user`, domínio `@testuser.com`) nunca é aceito em Checkout API — usar
  e-mail comum no teste. Ao testar de novo com e-mail comum, apareceu um `400`
  `transaction_amount must be positive` que **era bug nosso**: em `checkout.component.ts`,
  `finalizarPedido()` limpava o carrinho (`carrinhoService.limparCarrinho()`) antes de
  `gerarPagamentoPix()` ler `this.valorTotal()` — como esse total é derivado do carrinho, já
  lia 0 nesse ponto. Corrigido capturando `valorTotalPedido` antes de limpar o carrinho e
  passando esse valor adiante (também corrigido o mesmo problema no signal
  `valorTotalFinalizado`, usado pra exibir o valor na tela do QR code). Testado ponta a ponta
  com cartão de teste Visa/APRO → Pix gerado com valor correto. `mercado-pago-criar-pagamento`
  também ganhou log do header `x-request-id` do Mercado Pago em erros, pra facilitar chamado de
  suporte se aparecer instabilidade de novo (já visto: `500 internal_server_error`
  `communication_error` intermitente, mesma classe do problema antigo — não é bug nosso).
  Cartão de crédito continua fora (opção desabilitada no checkout, só Pix é real) — nunca
  processar número de cartão no nosso backend/frontend, usar o SDK de tokenização do Mercado
  Pago quando for a vez.
- **Retomada de pagamento Pix sem duplicar pedido, implementada (2026-09-24)** —
  `/checkout/:codigoRetomada` (`checkout.component.ts`, `modoRetomada`) reaproveita a etapa de
  revisão do checkout normal em modo leitura (stepper e "Editar" escondidos, frete sintetizado
  a partir do que já está salvo no pedido) pra deixar o cliente pagar de novo um Pix que
  falhou/expirou, sem passar de novo por `criarPedido` — só chama `criarPagamentoPix` pro
  mesmo `codigoPedido`. Link de entrada em `/pedido/:codigo` ("Tentar pagar de novo",
  `podeRetomarPagamento`) e no botão "Tentar novamente" da tela de erro do checkout. Coberto
  por `checkout.component.spec.ts` (só a parte de `modoRetomada`, 100%) e
  `pedido.component.spec.ts` (100%) — primeiros testes unitários do projeto.
  - **Risco não resolvido, não testável sem API real**: a chamada de retomada usa a mesma
    `X-Idempotency-Key` (o `codigoPedido`) que a criação original — não temos certeza do que o
    Mercado Pago devolve se essa chave já corresponder a um pagamento **expirado ou recusado**
    (o pagamento morto de volta, sem QR novo válido? um pagamento novo de verdade?). Se for o
    primeiro caso, o cliente fica num loop sem conseguir pagar esse pedido nunca mais. Só dá
    pra confirmar testando contra a API de verdade (não o sandbox instável) — não implementado
    nenhuma mitigação client-side por falta dessa confirmação.
  - **Quando implementar cartão de verdade**: replicar o mesmo padrão (tela de retomada em
    modo leitura + retry sem recriar pedido) pro cartão — hoje só existe pra Pix.
- **`pedido.component.ts` usa `route.snapshot.paramMap` (não reativo)** — mesma classe de bug
  encontrada e corrigida em `checkout.component.ts` (ver item de retomada acima: se o Angular
  Router reaproveitar a instância do componente ao navegar entre duas URLs `/pedido/:codigo`
  diferentes sem reload de página inteira, o snapshot fica travado no primeiro pedido
  carregado). Não corrigido aqui por estar fora do escopo da sessão que achou o problema —
  replicar o fix (trocar pra `route.paramMap` observable) se isso for confirmado como cenário
  real de navegação no app.
- **Instabilidade recorrente `500 internal_error` no Mercado Pago (2026-09-24)** — mesmo
  padrão já visto e reportado no chamado antigo (histórico acima), voltou a acontecer:
  `POST /v1/payments` (Pix) falhou duas vezes seguidas com `{"error":null,"message":
  "internal_error","status":500}`, X-Request-Id `f634b3d2-280e-499f-9e8b-c2fbdc1b0970` e
  `80094a1d-8f80-4b8f-bce5-c14b94814463`. Confirmado não relacionado a nenhuma mudança feita
  no mesmo dia (cadastro da assinatura secreta do webhook afeta só `mercado-pago-webhook`,
  função separada da que criou o pagamento). Reabrir chamado de suporte com esses dois IDs se
  persistir.
- **Webhook do Mercado Pago cadastrado** (2026-09-24) — URL
  `https://tmrtyotlvrznavjorkay.supabase.co/functions/v1/mercado-pago-webhook` registrada no
  Painel do Desenvolvedor (modo de teste), evento "Pagamentos (legacy)", e a assinatura
  secreta configurada como `MERCADO_PAGO_WEBHOOK_SECRET` na Edge Function (ativa a validação
  de assinatura no código, antes inativa por falta da secret). Teste de ponta a ponta
  (simular notificação → aprovação real) não deu pra validar: Pix de teste não pode ser pago
  por um app de banco real (não usa rede bancária de verdade), e como o webhook nunca confia
  no corpo da notificação — sempre reconsulta o pagamento real na API deles — simular a
  notificação só re-testaria nosso código reagindo a um pagamento que segue "pending" pra
  sempre. Validação completa de aprovação real só é possível em produção.
- **Domínio próprio** (`vistanostalgica.com.br`) — registro/DNS adiado por decisão do
  usuário, sem pressa. `environment.prod.ts` já está pronto com a URL certa, só falta
  registrar o domínio e apontar o DNS pro Netlify (painel do Netlify → domínio do site →
  Domain management → Add a domain). Destrava os dois itens abaixo.
- **E-mail de confirmação de pedido** — remetente hoje é o teste do Resend
  (`onboarding@resend.dev`), só entrega pro e-mail da própria conta Resend. Cliente real não
  recebe confirmação de compra. Precisa: domínio verificado no Resend + secret `RESEND_FROM`
  (ex.: `Vista Nostálgica <pedidos@vistanostalgica.com.br>`).

## 🟡 Recomendado antes de operar de verdade

- **SMTP customizado no Supabase Auth** — o login por link mágico em `/conta` usa o e-mail
  padrão do Supabase Auth (não o Resend — são dois sistemas diferentes), com limite de taxa
  baixo e remetente/template genéricos. Configurar em Project Settings → Auth → SMTP
  Settings, pode reaproveitar o Resend do item acima.
- **Melhor Envio em produção** — toda a integração (cotação, etiqueta, webhook) roda hoje só
  no Sandbox. Migrar exige: trocar o secret `AMBIENTE_MELHOR_ENVIO`, reautorizar o OAuth no
  ambiente de produção, e recadastrar o webhook lá (cadastro é por aplicativo/ambiente, não
  é automático).
- **Peso/dimensões em branco pra todo o catálogo** — a cotação de frete usa valor genérico
  (0,3kg, 20×5×25cm) até o admin preencher os reais. Risco de frete cobrado errado (a mais ou
  a menos) pro cliente. Afeta os 139 produtos importados da OZKLO (ver item abaixo) e também
  valia pros 128 produtos antigos do mock, hoje substituídos por eles (catálogo trocado
  inteiro em 2026-09-24 — ver "Importação do catálogo da OZKLO"). Confirmado por scraping
  (2026-09-24): peso/dimensões não são expostos de forma confiável em nenhuma página de
  produto da OZKLO (o peso só aparece, por acaso, no JSON-LD de *outros* produtos que
  aparecem no carrossel de relacionados de uma página — nunca no do próprio produto sendo
  visto; sem endpoint ou atributo sistemático pra raspar). Não dá pra resolver via scraping.
  Opções: pedir a planilha de peso/dimensões direto pro fornecedor, ou preencher manualmente
  no admin aos poucos.
- **Revisão jurídica/contábil da declaração de conteúdo (DC-e)** — usada no lugar de nota
  fiscal nas etiquetas (MVP). DC-e é oficialmente pra envios sem fins comerciais; usar pra
  venda é solução técnica temporária, fora das regras do Melhor Envio. Conversar com contador
  antes de operar assim por muito tempo em escala. NF-e automática e logística reversa ficam
  fora de escopo por enquanto.
- ~~**Evento `order.received` do Melhor Envio**~~ — investigado: nunca ocorreu em produção
  apesar de `created`, `released`, `ready-to-print`, `posted` e `delivered` já terem disparado
  de verdade várias vezes. Não se aplica ao nosso fluxo de compra de etiqueta via API (carrinho
  → checkout → gerar) — decidido não mapear pra não arriscar regressão de status caso apareça
  fora de ordem no futuro. Segue só logado em `eventos_webhook_melhor_envio`, sem ação.
- **Imagem de preview `og-padrao.jpg`** (`environment.prod.ts`/`SeoService`) é fictícia —
  subir uma imagem de verdade antes de publicar (afeta como o link aparece compartilhado no
  WhatsApp/Instagram/Facebook).
- **Rodar `docs/supabase/migration-016-cidades-frete-gratis.sql`** no SQL Editor do Supabase
  (produção) — adiciona a coluna `cidades_frete_gratis` em `configuracao_loja`. Sem isso, o
  admin não consegue salvar em `/admin/config` (a nova seção de cidades quebra o update).

## Importação do catálogo da OZKLO (2026-09-24)

- **Loja pivotou pra ser revendedora autorizada da OZKLO** — catálogo antigo (128 produtos
  mock, temas música/futebol/geek/automotivo/cinema/humor) apagado por decisão do usuário
  (`migration-024-reset-catalogo-para-ozklo.sql`, junto com pedidos/envios/eventos de
  webhook — dados de teste). Catálogo atual é 100% produtos da OZKLO.
- **Scripts em `scripts/importar-ozklo/`**: `scraper.py` (Playwright, baixa imagens + extrai
  nome/descrição/categoria/preço/variantes de cada produto pra `catalogo.json`) e
  `importar.py` (upsert numa tabela de staging por `url_origem`, sobe imagens pro Storage,
  cria produto novo ou atualiza só o que mudou em produto já vinculado — nunca sobrescreve
  nome/descrição/slug/categoria de um produto já existente). Rodar em `--dry-run` primeiro
  (default), confirmar com `--confirmar`. `MAPA_CATEGORIAS` no topo do `importar.py` traduz
  categoria da OZKLO -> slug da nossa: só o que é tema de verdade (Geek/Automotivo/Música via
  "Bandas"/Personagens) é mapeado — tipo de peça/corte (Unisex/Feminina/Polos/Básicas/
  Bermudas/Plus Size) não tem equivalente no nosso modelo (tema), fica sem categoria de
  propósito.
- **Categoria nova "Personagens"** criada (`migration-022-categoria-personagens.sql`) — a
  OZKLO tem essa como categoria própria, não existia nenhuma equivalente antes.
- **Tabela de staging** (`migration-023-staging-produtos-ozklo.sql`,
  `staging_produtos_ozklo`) — permite reraspagem idempotente (chave estável é `url_origem`,
  não o nome do produto) e vínculo manual a um produto já existente via SQL
  (`update staging_produtos_ozklo set produto_id = '...' where url_origem = '...'`) pra
  evitar duplicata semântica (mesmo produto físico, nome diferente na loja) — ver comentário
  no topo do `importar.py` pra sintaxe exata.
- **Extração de dado real** (depois de duas iterações corrigindo bugs — ver histórico do
  arquivo se precisar entender por quê): usa `window.LS.product`/`window.LS.variants` (estado
  do tema Tiendanube/Nuvemshop da própria loja, sempre do produto certo da página — os blocos
  JSON-LD `@type: Product` da página são ambíguos, incluem produtos do carrossel de
  relacionados, não só o produto atual) pra nome, preço, preço promocional, e variantes com
  cor/tamanho/estoque/SKU reais (não aproximados). Descrição vem do maior bloco `.user-content`
  do DOM. Categoria sugerida vem do único bloco JSON-LD `@type: WebPage` (breadcrumb, esse não
  é ambíguo). `imagens_por_cor` é montado casando `image_url` de cada variante com a foto já
  baixada da galeria (mesmo arquivo, só muda o protocolo da URL).
- **Peso/dimensões não capturados** — ver item na seção de bloqueadores acima, não dá pra
  raspar de forma confiável.
- **Estoque é o real da OZKLO** no momento da raspagem (campo `stock` de
  `window.LS.variants`), não um valor aproximado — mas como é o estoque *deles*, pode ficar
  desatualizado entre raspagens; reraspar e reimportar sincroniza automaticamente (variantes
  casadas por SKU).
- **28 produtos ficaram sem categoria** (nenhuma das sugeridas pela OZKLO bateu no
  `MAPA_CATEGORIAS`) — a maioria legitimamente não tem tema (bermudas, básicas), mas pelo
  menos 7 têm nome de personagem que a própria OZKLO não categorizou como "Personagens"
  (`camiseta-street-fighter`, `camiseta-top-gun`, `camiseta-bandeira-brasil`,
  `camiseta-meninas-super-poderosas`, `camiseta-pantera-cor-de-rosa`,
  `camiseta-paty-maionese-baby-look`, `camiseta-snoopy-baby-look`) — decisão do usuário foi
  deixar sem categoria e ajustar manualmente no admin depois, não corrigido automaticamente.
- **Credencial de admin foi colada em texto puro no chat** durante a importação (pra rodar os
  scripts) — recomendado trocar a senha de `/admin/login` depois, por precaução.

## Entrega presencial / frete grátis por cidade

- **Implementado**: `/admin/config` agora tem uma lista de cidades (nome + UF) onde a
  entrega/retirada é presencial — quando o CEP do cliente no checkout cai numa dessas
  cidades (comparação normalizada, sem acento/caixa, via `normalizarTexto`), a cotação do
  Melhor Envio é pulada e o frete vira grátis automaticamente (`checkout.component.ts`,
  `entregaLocalGratis`/`cotarFrete`). A opção sintética usa `id: 'entrega-local'` e nunca é
  enviada como `freteServicoId` do pedido — assim o admin não tenta comprar etiqueta do
  Melhor Envio pra ela (`podeComprarEtiqueta` já trata `freteServicoId` ausente como "sem
  etiqueta pra comprar").
- Não cobre casos como bairro específico dentro da cidade ou raio de distância — é
  cidade+UF inteira ou nada. Se precisar de granularidade menor no futuro, reavaliar.

## Reaproveitar o código pra outra loja temática

- **Varredura completa por referências hardcoded às categorias originais** (música, futebol,
  geek, automotivo, cinema, humor) — pedido explícito do usuário: quer criar lojas novas mais
  facilmente, então qualquer acoplamento indevido a essas 6 categorias específicas é bug, não
  só falta de dado. Achados e correções:
  - **`categoria.model.ts`**: `SlugCategoria` era uma union fixa com as 6 categorias, usada
    como tipo em `Produto.categorias` e forçada via `as SlugCategoria` no mapeamento da API
    (`catalogo-api.service.ts`). Nenhuma lógica de fato dependia dos valores específicos (é só
    passado adiante), mas o tipo mentia pro compilador e pra quem for programar numa loja
    nova. Virou `type SlugCategoria = string`, cast removido.
  - **`cabecalho.component.html`/`.ts`**: menu de navegação (desktop e mobile) tinha os 6
    links de categoria hardcoded — loja com categorias diferentes mostraria um menu todo
    errado, com links mortos. Agora busca `categorias()` via `CatalogoRepositorio` (mesmo
    padrão já usado na home) e itera com `@for`.
  - **`rodape.component.html`**: link "Produtos" apontava fixo pra `/categoria/geek`. Trocado
    por `routerLink="/" fragment="categorias"`, que leva pra seção de categorias da home
    (genérico, `anchorScrolling` já habilitado em `app.config.ts`).
  - `home.component.scss` (`.home-card-categoria--musica`/etc.), `temas.scss` (`.tema-*`) e
    `app.routes.ts` (textos institucionais) continuam com essas categorias — revisados e
    confirmados como intencionais: são decoração/design/conteúdo editorial específico de cada
    loja, não bug de acoplamento (documentado em detalhe nas entradas anteriores desta seção).
- **Identidade da loja parametrizada** — nome, descrição SEO, e-mail de contato, WhatsApp e
  redes sociais saíram do código e foram pra tabela `configuracao_loja` (linha única),
  editável em `/admin/config`. Buscada uma única vez via `APP_INITIALIZER` (não mais cada
  componente assinando por conta própria) e consumida como signal síncrono por `SeoService`,
  rodapé, WhatsApp flutuante, cabeçalho, home e admin-shell — nenhum desses tem mais o nome
  "Vista Nostálgica" hardcoded.
- **Investigado**: banner duplicado aparecendo na home só no `ng serve` (nunca no build de
  produção testado localmente via `dist/loja-tematica/server/server.mjs`) — causado por uma
  extensão de navegador (cupom/cashback, permitida em InPrivate) que fica fazendo polling
  contínuo na página; isso nunca deixa `ApplicationRef.isStable()` completar dentro dos 10s
  que a hidratação do Angular espera (`NG0506`), e o Angular acaba renderizando tudo de novo
  por cima do HTML do servidor. Não é bug do nosso código — confirmado comparando com a
  mesma extensão ativa contra um build de produção real, que carrega normalmente. Não precisa
  de ação, só não estranhar se aparecer de novo rodando `ng serve` com esse tipo de extensão.
- **O que ainda precisa mudar por loja** (não dá pra colocar em tabela, é infraestrutura):
  novo projeto Supabase inteiro (`environment.ts`/`.prod.ts`/`.development.ts` —
  `supabaseUrl`, `supabaseKey`, `mercadoPagoPublicKey`, `siteUrl`), conta Resend própria,
  conta Melhor Envio própria (endereço do remetente), possivelmente conta Mercado Pago
  própria (quem recebe o dinheiro é outro negócio), site novo no Netlify, domínio novo.
- **Paleta de cores por categoria** (`src/app/temas/temas.scss`) — revisado: continua sendo
  código, não banco (decisão de arte/design por categoria, `.tema-musica`/`.tema-geek` etc.);
  categorias diferentes numa loja nova exigem classes `.tema-*` novas de qualquer forma, não
  dá pra abstrair. Comentário no topo do arquivo agora deixa isso explícito pra quem for
  montar a loja nova.
- **`src/index.html`** — revisado: title/description/og/twitter hardcoded eram redundantes
  (sempre sobrescritos em toda requisição pelo SSR via `SeoService`, nunca vistos por usuário
  ou crawler real); trocados por placeholder genérico + comentário explicando. Favicon/
  manifest/apple-touch-icon continuam arquivo de verdade — só isso precisa trocar por loja.
- Textos institucionais longos (política de privacidade, como comprar etc. em
  `app.routes.ts`) — revisado: estrutura/prazos/parceiros continuam hardcoded (conteúdo
  jurídico/editorial específico de cada loja). As referências a nome da loja e e-mail de
  contato foram trocadas por placeholders `{{nomeLoja}}`/`{{emailContato}}`, resolvidos em
  runtime por `PaginaInstitucionalComponent` a partir de `ConfiguracaoLojaService` — pelo
  menos essas duas não precisam ser encontradas e trocadas manualmente numa loja nova.
- **Bugs encontrados rodando a loja "UtiliMaker" de verdade** (categorias diferentes das
  originais: música/futebol/geek/automotivo/cinema/humor), corrigidos aqui pra próxima loja
  não bater no mesmo problema:
  - `galeria-produto`: produto com 1 imagem só ficava espremido numa coluna de 76px — o grid
    `76px 1fr` da galeria assumia a coluna de miniaturas (só renderizada com 2+ imagens)
    sempre presente. Corrigido com `.galeria-produto__principal:only-child { grid-column: 1 /
    -1; }`, sem precisar de lógica no componente.
  - `home.component.scss`: cards de categoria na home ficavam sem fundo/com texto branco
    ilegível pra qualquer categoria fora da lista fixa `.home-card-categoria--musica/
    --futebol/--geek/--automotivo/--cinema/--humor`. Adicionado fallback genérico em
    `.home-card-categoria__cena` usando `var(--gradiente-tema)` (já definido por qualquer
    `.tema-<slug>`, aplicado no mesmo elemento) + um escurecimento por cima pra garantir
    contraste do texto branco independente da paleta da loja. As regras `--musica` etc.
    seguem existindo como textura extra só pra essas categorias específicas.
  - Textos hardcoded específicos de loja de camiseta: hero da home ("estampas de games,
    cinema, música, futebol, carros e humor... em forma de camiseta", link fixo "Direto pra
    Geek →"), seção de categorias ("Escolha sua tribo" / "Seis vitrines, uma coleção"), e
    contagem em "peças" (home e listagem) — trocados por texto genérico
    (`{{ nomeLoja() }}`, `{{ totalProdutos() }}`, CTA pra `primeiraCategoria()` dinâmica,
    "produtos" em vez de "peças").
  - `detalhe-produto`: breadcrumb da categoria mostrava o slug cru (ex.:
    `decoracao-e-organizacao`) em vez do nome de exibição — adicionado
    `nomeCategoriaPrincipal()`, que resolve o slug pra `categoria.nome` via
    `CatalogoRepositorio.obterCategorias()`.

## Ideias levantadas, ainda não implementadas

- **Avaliações/reviews de produto** — prova social é um dos maiores fatores de conversão em
  e-commerce de moda/estampa.
- **Produtos relacionados / "quem comprou também levou"** na página de produto.
- **Fluxo de troca/devolução dentro da conta** (`/conta`), em vez de só por e-mail.
- **Nota fiscal/comprovante pra download** em `/conta`.
- **Cupom de desconto**: limite de uso por cliente, cupom por categoria/produto, valor
  mínimo de pedido — deixado de fora de propósito do MVP atual.
- **PWA**: testar "Adicionar à tela inicial" de verdade no celular — só dá pra validar isso
  contra o site publicado (produção, HTTPS), não em `ng serve`.

## Marketing: tráfego pago e pixels de conversão

- **Pixels de conversão** (Meta Pixel, TikTok Pixel, Google Ads tag, GA4) — precisam
  disparar em cada troca de rota (hook em `Router` → `NavigationEnd`) e mapear o evento de
  conversão real (pedido finalizado no checkout).
- Consentimento de cookies/LGPD pra esses pixels é obrigatório antes de carregá-los (a
  Política de privacidade do rodapé ainda não fala em cookies de terceiros/pixels).
- **Catálogo dinâmico de produtos** (feed pro Meta Ads, por exemplo) — SSR já dá a base
  técnica, falta gerar o feed em si.
- **Decisão de negócio em aberto**: qual(is) plataforma(s) de tráfego pago vão rodar
  primeiro — define quais pixels instalar e se o catálogo dinâmico entra no escopo.
  Recomendação: decidir as plataformas antes de instalar qualquer pixel.
