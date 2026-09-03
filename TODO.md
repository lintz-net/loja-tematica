# TODO

## Acompanhamento de pedido

Hoje o cliente não tem como acompanhar o pedido depois da compra:
- `/checkout` só mostra uma tela de sucesso, sem número de pedido nem link de acompanhamento.
- `/conta` é um placeholder (nome/e-mail fixos), sem histórico de pedidos.

Isso depende de um backend real que persista pedidos (hoje é tudo mock). Quando for
implementar, duas abordagens possíveis:

1. **Área "Meus pedidos" em `/conta`** — exige login/cadastro real; mostra histórico e
   status de cada pedido. Melhor para clientes recorrentes.
2. **Link único de acompanhamento por pedido** (ex.: `/pedido/:codigo`, enviado por
   e-mail/WhatsApp) — não exige conta, mas cada pedido fica isolado, sem histórico
   consolidado.

### Rastreio de entrega — login é necessário?

Não necessariamente. Rastreio e "conta com histórico" são duas coisas diferentes que
tendem a ser confundidas:

- **Rastreio isolado por pedido** (abordagem 2 acima) resolve a dúvida sem exigir login:
  o cliente recebe um link único (`/pedido/:codigo`, por e-mail/WhatsApp) que mostra
  status + código de rastreio da transportadora. Mais simples de implementar, sem fluxo
  de autenticação, sem senha pra recuperar, sem LGPD de conta de usuário.
- **Login só passa a compensar** quando: (a) o negócio quer clientes recorrentes com
  histórico consolidado, favoritos vinculados à conta (hoje favoritos já funcionam sem
  login, via localStorage — ver `FavoritosService`), ou (b) o cliente compra por vários
  canais e precisa ver tudo num lugar só.
- **Meio-termo comum:** rastreio público por código (sem login) + login opcional depois,
  pra quem quiser salvar o histórico. Dá pra lançar o rastreio isolado primeiro sem
  fechar a porta pra conta completa depois.

Recomendação: começar pela abordagem 2 (link/código, sem login). É o menor escopo que já
resolve a dor real ("cadê meu pedido?"), e não bloqueia evoluir pra conta completa depois.

### Integração com Correios/transportadoras — é necessária?

Depende do que "acompanhar" precisa mostrar:

- **Sem integração** (mínimo viável): salvar os status do próprio pedido (recebido,
  confirmado, enviado, entregue) atualizados manualmente ou pelo processo interno, e
  exibir isso pro cliente. Não mostra a localização real da encomenda, só o status do
  pedido na loja.
- **Com integração**: chamar a API dos Correios (rastreamento por código) ou da
  transportadora parceira pra trazer o histórico real de movimentação (objeto postado,
  em trânsito, saiu pra entrega, entregue). Precisa que o pedido tenha um código de
  rastreio associado (gerado na hora do envio) e de credenciais/contrato com o
  Correios ou a transportadora.
- Como o rodapé já promete "Correios e transportadoras parceiras" e o checkout já
  simula opções de frete (`OPCOES_FRETE` em `checkout.component.ts`), a integração real
  de rastreio é o próximo passo natural — mas só faz sentido depois de existir um
  backend que persista pedidos e o processo de geração de etiqueta/código de rastreio
  no envio. Sem isso, não há o que consultar.

Recomendação: fase 1 sem integração (status interno do pedido); fase 2 pluga o código de
rastreio real quando o backend e o processo de envio existirem.

## Pagamento (Pix e Cartão de crédito)

Hoje o checkout (`checkout.component.ts`) já tem a etapa de pagamento inteira no
frontend — seleção Pix/cartão, campos de cartão com máscara e validação, cálculo de
parcelas — mas é **só simulação visual**: nenhum dado é enviado a lugar nenhum,
`finalizarPedido()` apenas gera um código local (`VT-xxxxxx`) e limpa o carrinho. Não
existe cobrança real.

Pontos a decidir antes de implementar:

- **Nunca processar número de cartão no nosso próprio backend/frontend.** Isso exige
  certificação PCI-DSS (caro e complexo pra um projeto desse porte). O caminho padrão de
  mercado é usar um gateway/PSP (ex.: Mercado Pago, Pagar.me, Stripe, Cielo, PagSeguro)
  que fornece SDK de tokenização no frontend — o cartão vai direto do navegador do
  cliente pro PSP, e a loja só recebe um token/confirmação, nunca o número real.
- **Pix** é mais simples de simular no backend: o PSP gera um QR code/copia-e-cola por
  pedido, e a confirmação chega via webhook quando o pagamento cai. Não tem passo de
  "captura de dados sensíveis" como o cartão.
- Isso também depende do backend real de pedidos (mesma dependência do item de
  acompanhamento acima): precisa existir um pedido persistido pra associar a cobrança,
  e um endpoint que receba o webhook de confirmação do PSP e atualize o status.
- Campos hoje coletados no formulário de cartão (`numeroCartao`, `cvvCartao`, etc.) para
  simulação visual **não devem ser reaproveitados como estão** — na integração real esses
  campos alimentam o SDK do PSP (que os processa e descarta), não vão em um `POST` pro
  nosso backend.
- Escolha do PSP é uma decisão de negócio (taxas, prazo de repasse, suporte a Pix e
  parcelamento, se já existe conta/CNPJ cadastrado em algum) — vale decidir isso antes de
  desenhar a integração técnica.

Recomendação: escolher o PSP primeiro (decisão de negócio), depois desenhar backend de
pedidos + integração de pagamento junto — os dois TODOs desta seção e o de
"Acompanhamento de pedido" acima compartilham a mesma dependência raiz (backend real de
pedidos), então faz sentido planejar as três coisas como uma frente só.

## Marketing: tráfego pago e integração com redes sociais (SSR/Angular Universal)

Foco aqui é marketing — pixels de conversão, campanhas pagas e preview de link ao
compartilhar produtos —, não login social. Hoje `src/index.html` não tem nenhuma tag
`og:*`/`twitter:*` e o projeto não tem SSR configurado (`ng add @angular/ssr`, sucessor
do antigo Angular Universal) — greenfield nos dois. São duas frentes distintas,
resolvidas de jeitos diferentes:

- **SSR (Angular Universal/`@angular/ssr`) resolve:**
  - Preview de link ao compartilhar produtos em redes sociais e apps de mensagem
    (WhatsApp, Instagram, TikTok, Facebook) — os crawlers desses apps não executam JS,
    então numa SPA pura eles não conseguem montar o card (imagem/título/preço) a partir
    de tags `og:*`/`twitter:*`. Precisa de HTML já pronto no servidor. Isso importa tanto
    pra compartilhamento orgânico quanto pra anúncios que usam a própria página de
    produto como destino (ex.: catálogo dinâmico do Meta Ads).
  - SEO orgânico no Google (indexação mais rápida e completa) — reduz dependência de
    tráfego 100% pago.
  - Performance de primeira carga (FCP/LCP), o que também ajuda o Quality Score/CPC de
    campanhas pagas.
  - Também precisa gerar `og:*` por página (produto, categoria) dinamicamente — SSR
    sozinho não gera as tags, só faz elas existirem no HTML servido.

- **SSR não resolve** (pixels/tags são scripts client-side, funcionam normal em SPA):
  - **Pixels de conversão** (Meta Pixel, TikTok Pixel, Google Ads tag, GA4) — funcionam
    em SPA, mas precisam disparar em cada troca de rota (hook em `Router` →
    `NavigationEnd`, já que uma SPA não recarrega a página como esses scripts esperam
    por padrão) e mapear o evento de conversão real (provavelmente "pedido finalizado"
    no checkout).
  - Consentimento de cookies/LGPD pra esses pixels é obrigatório antes de carregá-los
    (hoje a `Política de privacidade` do rodapé não fala em cookies de terceiros/pixels).

- **Ainda em aberto (decisão de negócio, não técnica):** qual(is) plataforma(s) de
  tráfego pago vão rodar primeiro (Meta Ads, Google Ads, TikTok Ads) — define quais
  pixels instalar e se catálogo de produto dinâmico (que depende de SSR + feed de
  produtos) entra no escopo.

Recomendação: SSR é pré-requisito só pro item de preview social/catálogo dinâmico — dá
pra instalar pixels de conversão e GA4 sem SSR, então essas frentes podem ser paralelas,
não sequenciais. Vale decidir as plataformas de anúncio antes de instalar qualquer pixel.
