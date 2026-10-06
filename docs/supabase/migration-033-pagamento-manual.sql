-- Rode isto no SQL Editor do Supabase.
--
-- Contexto (2026-10-06): opção pra habilitar um terceiro jeito de fechar o pedido no checkout
-- — "Combinar pagamento" — sem passar pelo Mercado Pago (pedido criado com
-- status_pagamento pendente, admin confirma manualmente em /admin/pedidos quando receber).
-- Inspirado no modelo da Vendizap (dinheiro/maquininha/Pix manual), mas simplificado pra uma
-- única opção genérica em vez de várias sub-formas configuráveis.
--
-- Padrão `false` de propósito: Pix/cartão via Mercado Pago continuam sendo as únicas opções
-- até o lojista decidir habilitar isso.

alter table configuracao_loja
  add column if not exists aceita_pagamento_manual boolean not null default false;
