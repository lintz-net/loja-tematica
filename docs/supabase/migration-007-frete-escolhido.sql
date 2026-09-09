-- Rode isto no SQL Editor do Supabase.
-- Guarda qual serviço de frete o cliente escolheu no checkout (transportadora, serviço,
-- id do serviço na Melhor Envio) — necessário pra comprar a etiqueta depois.

alter table pedidos
  add column if not exists frete_servico_id text,
  add column if not exists frete_transportadora text,
  add column if not exists frete_servico_nome text,
  add column if not exists frete_prazo_dias integer;
