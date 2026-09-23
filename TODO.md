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
- **Peso/dimensões dos 128 produtos migrados do mock** — colunas ainda em branco, a cotação
  de frete usa valor genérico (0,3kg, 20×5×25cm) até o admin preencher os reais. Risco de
  frete cobrado errado (a mais ou a menos) pro cliente.
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
