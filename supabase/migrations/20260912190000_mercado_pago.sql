-- Rode isto no SQL Editor do Supabase.
-- Pagamento real via Mercado Pago — Pix primeiro (cartão fica pra depois, com tokenização
-- via SDK do Mercado Pago; nunca reaproveitar os campos de cartão simulados do checkout).

-- 1) Status de pagamento do pedido — independente do `status` existente (que é de
-- logística/pedido: recebido/confirmado/enviado/entregue). Todo pedido novo nasce
-- 'pendente' até o webhook do Mercado Pago confirmar.
alter table pedidos
  add column if not exists status_pagamento text not null default 'pendente'
    check (status_pagamento in ('pendente', 'aprovado', 'recusado', 'cancelado', 'expirado')),
  add column if not exists id_pagamento_mercado_pago text,
  add column if not exists pix_qr_code text,
  add column if not exists pix_qr_code_base64 text,
  add column if not exists pix_expira_em timestamptz;

create index if not exists idx_pedidos_id_pagamento_mercado_pago
  on pedidos(id_pagamento_mercado_pago);

-- 2) Log de eventos recebidos do webhook do Mercado Pago — mesmo padrão de
-- eventos_webhook_melhor_envio: só admin lê, só service_role escreve (a Edge Function do
-- webhook usa a service_role key, que ignora RLS).
create table if not exists eventos_webhook_mercado_pago (
  id uuid primary key default gen_random_uuid(),
  tipo_evento text not null,
  id_pagamento_mercado_pago text,
  payload jsonb not null,
  recebido_em timestamptz not null default now()
);

alter table eventos_webhook_mercado_pago enable row level security;

create policy "Admin pode ler eventos de webhook do Mercado Pago"
  on eventos_webhook_mercado_pago for select
  to authenticated
  using (true);
