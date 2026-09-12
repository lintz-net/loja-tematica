# TODO

## 🔴 Bloqueadores pra produção

- **Pagamento real (Mercado Pago)** — backend pronto e deployado: migration
  (`status_pagamento`, `eventos_webhook_mercado_pago`), Edge Functions
  `mercado-pago-criar-pagamento`/`mercado-pago-webhook`, e o checkout já chama tudo isso de
  verdade (tela de QR code Pix + polling até aprovação). Testado ponta a ponta e **bloqueado
  pelo Mercado Pago**: `POST /v1/payments` devolve sempre `500 internal_error` genérico pra
  essa conta/aplicação de teste, tanto Pix quanto cartão (confirmado isolando a chamada fora
  do nosso backend). Corrigido o `address_pending` da conta (endereço estava vazio no cadastro
  do Mercado Livre/Pago), mas o 500 persistiu. Confirmado com o suporte deles que Pix não é
  testável em sandbox (só cartão de teste) — mesmo assim o cartão de teste também dá 500.
  Chamado aberto no suporte do Mercado Pago aguardando retorno. PSP escolhido: Mercado Pago,
  Pix primeiro (sem tokenização de cartão), cartão depois — Efí e Stripe cogitados como
  alternativas caso o suporte não resolva. Nunca processar número de cartão no nosso
  backend/frontend — usar o SDK de tokenização do Mercado Pago quando for a vez do cartão real
  (a opção "Cartão" no checkout está desabilitada por ora, só Pix é real).
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
