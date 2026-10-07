-- Rode isto no SQL Editor do Supabase.
--
-- Bug (2026-10-07): a migration-033 adicionou a opção "Combinar pagamento" (formaPagamento
-- 'manual') no código, mas esqueceu de atualizar a constraint do banco — `pedidos` só
-- aceitava `forma_pagamento in ('cartao', 'pix')` (ver `docs/supabase/schema.sql`). Qualquer
-- pedido com pagamento manual falhava no insert com "violates check constraint
-- pedidos_forma_pagamento_check" (23514), confirmado em teste real do usuário.

alter table pedidos drop constraint if exists pedidos_forma_pagamento_check;
alter table pedidos add constraint pedidos_forma_pagamento_check
  check (forma_pagamento in ('cartao', 'pix', 'manual'));
