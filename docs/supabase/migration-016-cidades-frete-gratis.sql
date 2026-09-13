-- Rode isto no SQL Editor do Supabase.
-- Lista de cidades onde a loja entrega/retira pessoalmente (sem transportadora) — configurável
-- em /admin/config. Quando o CEP do cliente cai numa dessas cidades, o checkout pula a
-- cotação do Melhor Envio e oferece frete grátis direto.

alter table configuracao_loja
  add column if not exists cidades_frete_gratis jsonb not null default '[]'::jsonb;

comment on column configuracao_loja.cidades_frete_gratis is
  'Array de {"cidade": "...", "uf": "..."} — cidades onde a entrega/retirada é presencial e grátis.';
