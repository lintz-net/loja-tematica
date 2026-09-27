# TODO

## 🔴 Bloqueadores pra produção

- **Compliance PCI do pagamento por cartão — decisão consciente, pendência real** — o
  pagamento por cartão foi implementado como **Checkout API** (formulário de cartão no nosso
  próprio site, tokenizado via SDK.js do Mercado Pago antes de qualquer coisa chegar no
  backend — ver `checkout.component.ts`/`mercado-pago-sdk.service.ts`), não como
  **Checkout Pro** (redirect pra página deles). Mesmo o número do cartão nunca tocando nosso
  backend, hospedar o formulário no nosso domínio classifica a loja num nível de certificação
  PCI DSS mais exigente (**SAQ A-EP**, não o SAQ A mais simples do Checkout Pro) — precisa
  preencher esse questionário de autoavaliação formalmente com o Mercado Pago antes de operar
  cartão de verdade em produção com volume real. Decisão discutida e confirmada com o usuário
  em 2026-09-25: manter o Checkout API por causa da UX (cliente nunca sai do site), aceitando
  essa obrigação extra de compliance conscientemente — Checkout Pro (mais simples, SAQ A) foi
  oferecido como alternativa e recusado.
- **Status do pedido (logística) automatizado, implementado em 2026-09-25** —
  `pedidos.status` (recebido/confirmado/enviado/entregue, mostrado na barra de cima de
  `/pedido/:codigo`) antes só mudava manualmente pelo admin em `/admin/pedidos`. Agora avança
  sozinho em três pontos, sempre só pra frente (nunca regride um status que já esteja mais
  adiantado — cada chamada usa um filtro `status=in.(...)` restrito aos status anteriores):
  - Pagamento aprovado (Pix via `mercado-pago-webhook`, cartão via resposta síncrona de
    `mercado-pago-criar-pagamento-cartao`) → `recebido` vira `confirmado`
    (`avancarStatusParaConfirmado`, `_shared/mercado-pago.ts`, compartilhado pelas duas).
  - Evento `order.posted` do Melhor Envio → `enviado`.
  - Evento `order.delivered` do Melhor Envio → `entregue`.
  Testado ponta a ponta: pagamento por cartão aprovado (titular APRO) fez o pedido
  `VT-H8SOSZ` aparecer como "Confirmado" em `/pedido/:codigo` sem nenhuma ação manual.
  **Parte de envio testada parcialmente em 2026-09-27** — pedido de teste `VT-K19HWX`
  (frete real Jadlog, cotado via `melhor-envio-cotar` pra 3 CEPs diferentes — só Jadlog
  disponível nessa conta sandbox, Correios não aparece em nenhuma cotação). Confirmado que o
  webhook recebe e processa eventos reais automaticamente, **sem nenhuma ação manual nossa**:
  duas transições capturadas ao vivo — `gerado → cancelado` (primeira etiqueta, cancelada
  manualmente no painel deles depois de falhar a geração do PDF) e `gerado → liberado`
  (segunda tentativa, com sucesso). **Não chegou a `postado`/`entregue`** dentro de ~20min de
  observação — sandbox não é instantâneo, pode levar mais tempo (já confirmado em investigação
  anterior que `posted`/`delivered` disparam de verdade nesse sandbox, só não dentro da janela
  observada desta vez). Retomar esse teste specific (só falta essas duas transições) se puder
  observar por mais tempo, ou aceitar a evidência já coletada como suficiente — a integração
  do webhook em si (recebimento + parsing + atualização de status) já está comprovada
  funcionando com dados reais, só não com os dois eventos finais específicos.
  - **Achado à parte, não é bug nosso**: a primeira tentativa de gerar a etiqueta Jadlog
    falhou no sandbox deles com "Um erro de sistema impediu a geração da etiqueta" — confirmado
    que nossa Edge Function (`melhor-envio-comprar-etiqueta`) seguiu o fluxo documentado
    corretamente (`/cart` → `/checkout` → `/generate` → `/print`, todas retornando 200 OK);
    a falha aconteceu depois, no processamento assíncrono deles. Mesma classe da instabilidade
    `500 internal_error` já registrada pro Mercado Pago. Retry manual no painel deles
    ("GERAR NOVAMENTE") também falhou a primeira vez; cancelar e comprar uma etiqueta nova pro
    mesmo pedido funcionou na segunda tentativa (chegou até "liberado"), mas uma nova falha de
    geração apareceu de novo depois (ORD diferente, mesma mensagem de erro) — confirma que é
    **instabilidade intermitente**, não algo que retry resolve de forma confiável hoje.
    **Evidência forte de que o pipeline completo funciona quando o sandbox coopera**: a aba
    "Postados" do painel deles mostra 4 envios de testes anteriores (fora desta sessão, de uma
    investigação prévia) com status **"Entregue"** e código de rastreio real — prova que
    `gerado → liberado → postado → entregue` já rodou ponta a ponta nesse mesmo sandbox antes.
    Não vale insistir mais hoje; retomar em outro dia (ou aceitar a evidência já coletada como
    suficiente — o webhook em si já está comprovado funcionando com eventos reais).
  - **Dois gaps reais encontrados a partir do log de eventos** (`eventos_webhook_melhor_envio`),
    não é só instabilidade de sandbox:
    1. ~~**`podeComprarEtiqueta` não permitia comprar etiqueta nova pra envio `cancelado`**~~
       — **corrigido em 2026-09-27**. A sequência de eventos recebida nas duas tentativas
       (`order.created → order.released [→ order.cancelled]`) mostra que `status_envio` pode
       legitimamente virar `cancelado` (admin cancelando no painel do Melhor Envio, ex.: pra
       tentar de novo depois de uma geração travada) — antes disso, o botão "Comprar etiqueta"
       simplesmente sumia da tela pra esse pedido, sem nenhuma opção visível, e só dava pra
       destravar via UPDATE direto no banco (foi o que precisei fazer manualmente pra continuar
       o teste). Agora `'cancelado'` entra na lista de status que permitem comprar de novo,
       igual a `aguardando_compra`/`pendente_etiqueta`.
    2. ~~**`status_envio: 'gerado'` é otimista demais**~~ — **corrigido em 2026-09-27**. Nossa
       Edge Function marcava `'gerado'` direto da resposta HTTP 200 de
       `/api/v2/me/shipment/generate`, mas o log mostrou que **nenhuma das duas tentativas**
       recebeu o evento `order.generated` (existe um mapeamento pra ele em
       `SUFIXO_PARA_STATUS_ENVIO`, nunca disparou nos testes) — só `created`/`released`
       (/`cancelled`). Ou seja, o 200 deles significa "pedido de geração aceito pra
       processamento assíncrono", não "etiqueta gerada de verdade", e era por isso que o
       painel deles mostrava erro de geração mesmo com nosso banco dizendo "gerado", sem
       nenhum jeito do admin perceber. Corrigido: novo status `'processando'` (migration
       `migration-028-status-envio-processando.sql`, novo valor no `CHECK` de
       `envios.status_envio`, deploy da Edge Function feito) — a Edge Function agora marca
       `'processando'` (não `'gerado'`) depois do 200 síncrono; `'gerado'` de verdade só passa
       a vir do webhook `order.generated`, que já tinha o mapeamento pronto e simplesmente
       nunca era a fonte real desse status. `'processando'` bloqueia comprar etiqueta de novo
       (evita duplicar) igual a `'gerado'`/`'liberado'` já bloqueavam, e aparece como "aviso à
       parte" (não como degrau da timeline) em `/pedido/:codigo`, mesmo tratamento que
       `aguardando_compra`/`pendente_etiqueta` já tinham.
       - ~~**Timeout/alerta se ficar `'processando'` demais**~~ — **versão leve implementada em
         2026-09-27**: detecção **client-side**, sem cron/infra nova —
         `admin-pedidos.component.ts` (`envioTravado`, `TIMEOUT_PROCESSANDO_MS = 20min`) marca
         como travado quando `atualizadoEm` do envio passa de 20min parado em `'processando'`,
         checado só quando a tela `/admin/pedidos` é aberta/atualizada (sem polling em
         background). Quando travado: aparece um aviso "Travado? Confira o Melhor Envio" na
         linha do pedido, e o botão "Comprar etiqueta" volta a aparecer (mesmo tratamento que
         `pendente_etiqueta`/`cancelado` já tinham). **Limitação consciente**: só funciona se
         alguém abrir a tela — não notifica proativamente ninguém.
       - **Alternativa mais robusta, não implementada** (considerada e adiada por enquanto): um
         cron (`pg_cron` ou Edge Function agendada) que varre `envios` presos em `'processando'`
         além do timeout e muda sozinho pra `'pendente_etiqueta'` com uma mensagem de erro —
         reaproveitando o fluxo de retry que já existe, em vez de só mostrar um aviso passivo.
         Mais confiável (não depende de ninguém estar olhando a tela), mas exige agendamento
         (nova peça de infra pra manter, precisa da extensão `pg_cron` habilitada no projeto).
         Vale revisitar se o volume de pedidos crescer a ponto de um envio travado passar
         despercebido por muito tempo sem ninguém abrir `/admin/pedidos`.

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
  Cartão de crédito: ver item próprio abaixo (implementado em 2026-09-25).
- **Pagamento por cartão de crédito, implementado (2026-09-25)**, com parcelamento sem juros
  em até 6x adicionado depois (2026-09-25) — seletor de parcelas no checkout
  (`opcoesParcelas`/`quantidadeMaximaParcelas` em `checkout.component.ts`), limitado por
  `MAX_PARCELAS` e `VALOR_MINIMO_PARCELA` (R$5/parcela — `parcelamento.constantes.ts`). Quem
  faz a divisão de verdade na cobrança é o próprio Mercado Pago (`installments` no payload de
  `/v1/payments`, antes hardcoded em 1); a loja só decide até quantas parcelas oferecer.
  `MercadoPagoSdkService` carrega a SDK.js
  do Mercado Pago (`https://sdk.mercadopago.com/js/v2`) sob demanda, só quando o cliente
  escolhe cartão — número/CVV nunca chegam no nosso backend, só o token de uso único gerado
  no navegador (`mp.createCardToken`). Nova Edge Function
  `mercado-pago-criar-pagamento-cartao` cobra com esse token; diferente do Pix, a resposta já
  vem com o status final na hora (approved/rejected/in_process), então `status_pagamento` é
  atualizado direto ali, sem esperar o webhook. `STATUS_MP_PARA_STATUS_PAGAMENTO` (o mapa de
  status do Mercado Pago pros nossos) foi movido pra `_shared/mercado-pago.ts`, reaproveitado
  também pelo webhook. Removido o checkbox "Manter salvo para próximas compras" que existia
  na UI — não tinha implementação nenhuma por trás, era enganoso deixar visível.
  - **Idempotency key é aleatória por tentativa** (`crypto.randomUUID()`), não fixa por
    `codigoPedido` como no Pix — decisão deliberada: o token é de uso único, então uma nova
    tentativa depois de recusada é uma cobrança nova de verdade (não um retry de clique
    duplo). Fixar a key aqui correria o mesmo risco já registrado no item de retomada do Pix
    abaixo (Mercado Pago podendo devolver a resposta antiga em vez de processar o token novo).
  - ~~**Não enviado**: nenhum dado de "device fingerprint"/antifraude~~ — **implementado em
    2026-09-27**. Os MCP servers do Mercado Pago (`mcp-mercado-pago`/`mercadopago`) deram 403
    do CloudFront ao tentar autorizar (bloqueio de infraestrutura, não da conta do usuário —
    endpoint deles parece não estar publicamente acessível ainda). Confirmado por outra via:
    `WebSearch` + `WebFetch` direto na documentação oficial
    (`mercadopago.com.br/developers/.../improve-payment-approval/recommendations`) e numa
    discussão do repositório `mercadopago/sdk-js` no GitHub — duas fontes independentes
    convergindo no mesmo ponto crítico que estava em aberto: o device id vai como **header**
    `X-meli-session-id` no `POST /v1/payments` (não campo do body). `MercadoPagoSdkService`
    ganhou `carregarScriptSeguranca()` (injeta `https://www.mercadopago.com/v2/security.js`
    com `view="checkout"`, nunca rejeita — falha em carregar não pode bloquear o pagamento) e
    `obterDeviceId()` (lê `window.MP_DEVICE_SESSION_ID` com polling curto, timing de
    preenchimento não é imediato nem documentado oficialmente). Script carregado cedo — ao
    escolher "cartão" no checkout (`selecionarFormaPagamento`) ou ao entrar em retomada de
    cartão — não só no clique de pagar, pra dar tempo do fingerprint ficar pronto.
    `criarPagamentoCartao` ganhou `deviceId?: string` opcional; a Edge Function
    `mercado-pago-criar-pagamento-cartao` manda como `X-meli-session-id` quando presente, sem
    exigir (nunca bloqueia a cobrança por falta dele).
  - ~~**Retomada de pagamento** (`/checkout/:codigoRetomada`) continua só pra Pix~~ —
    **implementado em 2026-09-27**. `iniciarRetomada()` não filtra mais por
    `formaPagamento === 'pix'`, só por `statusPagamento` ('pendente' ou 'recusado', dos dois
    jeitos de pagamento — cartão pode ficar 'pendente' via `in_process`/`in_mediation` do
    Mercado Pago). Diferente do Pix (revisão 100% somente-leitura), cartão sempre exige um
    token novo (uso único, expira), então a etapa de revisão passa a mostrar o formulário de
    cartão de novo quando `modoRetomada() && formaPagamento() === 'cartao'` — os campos
    (`checkout.component.html`) foram extraídos pra um `<ng-template #camposCartao>`
    reaproveitado tanto no passo normal de pagamento quanto aqui, evitando duplicar a
    marcação. Idempotency key continua aleatória por tentativa (já era o comportamento do
    cartão, diferente do risco não resolvido do Pix logo abaixo — não havia nada a mudar
    aí). Sem polling em background durante a retomada de cartão (só faz sentido pro Pix, que
    pode ser aprovado por fora via webhook enquanto o cliente olha a tela parado).
  - **Testado ponta a ponta em 2026-09-25**: cartão de teste Mastercard/APRO → pagamento
    aprovado na hora, `status_pagamento` e `id_pagamento_mercado_pago` gravados certos no
    pedido (confirmado direto no banco via `obter_pedido_por_codigo`). Cartão titular OTHE →
    recusado como esperado, tela de erro certa ("Pagamento recusado pelo cartão", botões
    "Tentar novamente"/"Acompanhar pedido" + dica de "Minha conta → Meus pedidos").
- **Retomada de pagamento Pix sem duplicar pedido, implementada (2026-09-24)** —
  `/checkout/:codigoRetomada` (`checkout.component.ts`, `modoRetomada`) reaproveita a etapa de
  revisão do checkout normal em modo leitura (stepper e "Editar" escondidos, frete sintetizado
  a partir do que já está salvo no pedido) pra deixar o cliente pagar de novo um Pix que
  falhou/expirou, sem passar de novo por `criarPedido` — só chama `criarPagamentoPix` pro
  mesmo `codigoPedido`. Link de entrada em `/pedido/:codigo` ("Tentar pagar de novo",
  `podeRetomarPagamento`) e no botão "Tentar novamente" da tela de erro do checkout. Coberto
  por `checkout.component.spec.ts` (só a parte de `modoRetomada`, 100%) e
  `pedido.component.spec.ts` (100%) — primeiros testes unitários do projeto.
  - ~~**Risco não resolvido, não testável sem API real**~~ — **mitigado em 2026-09-27**, sem
    precisar confirmar o comportamento exato do Mercado Pago. A chamada de retomada usava a
    mesma `X-Idempotency-Key` (o `codigoPedido`) que a criação original — sem certeza do que
    eles devolvem se essa chave já corresponder a um pagamento **expirado ou recusado** (o
    pagamento morto de volta, sem QR novo válido? um pagamento novo de verdade?). Em vez de
    esperar acesso à API real pra confirmar, a mitigação foi remover a ambiguidade: novo
    campo `retomada?: boolean` em `criarPagamentoPix` (`checkout.component.ts` passa
    `this.modoRetomada()`) — quando `true`, a Edge Function `mercado-pago-criar-pagamento`
    usa uma idempotency key **única por tentativa** (`${codigoPedido}-retomada-${uuid}`) em
    vez da fixa por pedido, mesmo padrão que o pagamento por cartão já usa. Garante um Pix
    genuinamente novo a cada retomada, sem depender de nenhuma resposta específica deles. A
    criação original (não-retomada) continua com chave fixa por `codigoPedido` — não perde a
    proteção contra retry de rede/clique duplo nesse momento, que é quando mais importa (a
    proteção equivalente na retomada já vem do botão "Pagar agora" ficar desabilitado durante
    o envio). Deploy da Edge Function feito.
- ~~**`pedido.component.ts` usa `route.snapshot.paramMap` (não reativo)**~~ — **resolvido em
  2026-09-27**. Mesma classe de bug já corrigida em `checkout.component.ts`, replicada aqui:
  trocado por `route.paramMap` observable (`takeUntilDestroyed`), carregamento extraído pra
  `carregarPedido(codigo)`, com cancelamento explícito da inscrição Realtime anterior antes de
  assinar a do novo código (evita acumular listeners quando o Router reaproveita a instância
  navegando entre `/pedido/:codigo` diferentes).
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
- **SMTP customizado no Supabase Auth** — o login por link mágico em `/conta` usa o e-mail
  padrão do Supabase Auth (não o Resend — são dois sistemas diferentes), com limite de taxa
  baixo e remetente/template genéricos. Configurar em Project Settings → Auth → SMTP
  Settings, pode reaproveitar o Resend do item acima.
- **Melhor Envio em produção** — toda a integração (cotação, etiqueta, webhook) roda hoje só
  no Sandbox. Migrar exige: trocar o secret `AMBIENTE_MELHOR_ENVIO`, reautorizar o OAuth no
  ambiente de produção, e recadastrar o webhook lá (cadastro é por aplicativo/ambiente, não
  é automático).

## 🟡 Recomendado antes de operar de verdade

- ~~**Peso/dimensões em branco pra todo o catálogo**~~ — **resolvido em 2026-09-26**. Peso
  confirmado com o usuário: P/M/G = 0,25kg·3×25×35cm, GG/G1/G2/XG = 0,30kg·3×27×37cm. Como
  peso/dimensões são salvos por PRODUTO (não por tamanho) e a maioria dos produtos mistura
  P/M/G com GG na mesma ficha, aplicado sempre o peso do MAIOR tamanho presente — nunca
  subestima o frete, só superestima levemente um P/M/G isolado de um produto que também tem
  GG. Backfill rodado em produção
  (`docs/supabase/migration-025-peso-dimensoes-catalogo.sql`, só preenche `is null`, não
  sobrescreve ajuste manual): 132 produtos ficaram com 0,30kg, 7 com 0,25kg. Importador da
  OZKLO (`scripts/importar-ozklo/importar.py`, `calcular_peso_dimensoes`) também ajustado pra
  produto novo já nascer com o valor certo, não `None` — sem isso essa mesma lacuna voltaria a
  cada reimportação. Confirmado por scraping (2026-09-24): peso/dimensões reais não são
  expostos de forma confiável em nenhuma página de produto da OZKLO (só aparecem, por acaso,
  no JSON-LD de *outros* produtos do carrossel de relacionados) — por isso a solução foi por
  regra de tamanho, não por dado raspado.
  - **Correção em 2026-09-26**: a regra por tamanho (pensada só pra camiseta) tinha sido
    aplicada por engano também às 5 bermudas do catálogo (peça diferente — tecido mais
    grosso, mais volume, não deveria seguir a mesma regra). Corrigido com valores próprios por
    produto (`migration-026-peso-dimensoes-bermudas.sql`, UPDATE direto por id, sem regra de
    tamanho): Tactel 0,25kg·3×25×30cm; Elanca/Ribana/Linho 0,30kg·4×25×30cm; Sarja (8 bolsos)
    0,45kg·6×27×32cm. **Generalizado no importador em 2026-09-26**
    (`calcular_peso_dimensoes_bermuda`, casa por palavra-chave no nome do produto —
    tactel/elanca/ribana/linho/sarja): bermuda nova numa reimportação futura já usa a tabela
    certa em vez de herdar a regra de camiseta; modelo desconhecido cai num fallback (valor
    do meio) e imprime aviso pra revisão manual, em vez de errar silenciosamente.
  - **Correção em 2026-09-26**: mesma classe de problema também dentro de camiseta — a regra
    por tamanho é só uma média grosseira, ignora que dry fit/poliamida é bem mais leve que
    suedine oversized. Ajustado por TECIDO (palavra-chave no nome) pros 6 produtos que bateram
    no catálogo (`migration-027-peso-dimensoes-camiseta-por-tecido.sql`): dry
    fit/poliamida 0,20kg·3×25×35cm; estonada 0,28kg·3×27×37cm; oversized/suedine
    0,35kg·4×30×40cm; polo 0,32kg·4×27×37cm. Camiseta sem palavra-chave de tecido especial
    (a maioria — algodão comum) continua na regra por tamanho de sempre, sem aviso (não é
    lacuna, é o normal do catálogo). Generalizado no importador
    (`calcular_peso_dimensoes_camiseta`): produto novo com um desses tecidos no nome já entra
    com o peso certo, sem precisar de outro backfill.
- ~~**Evento `order.received` do Melhor Envio**~~ — investigado: nunca ocorreu em produção
  apesar de `created`, `released`, `ready-to-print`, `posted` e `delivered` já terem disparado
  de verdade várias vezes. Não se aplica ao nosso fluxo de compra de etiqueta via API (carrinho
  → checkout → gerar) — decidido não mapear pra não arriscar regressão de status caso apareça
  fora de ordem no futuro. Segue só logado em `eventos_webhook_melhor_envio`, sem ação.

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
