-- Rode isto no SQL Editor do Supabase.
-- Ajusta peso/dimensões de camisetas por TECIDO (dry fit/poliamida, estonada, oversized/
-- suedine, polo) — sobrescreve o valor genérico por tamanho da migration-025, que não
-- distinguia tecido. Casa por palavra-chave no nome (case-insensitive), e nunca mexe em
-- bermuda (peça diferente, já tratada na migration-026).
-- Valores fornecidos pelo usuário (2026-09-26).

-- Dry Fit / poliamida — 0,20kg · 3×25×35cm
update produtos
set peso_kg = 0.20, altura_cm = 3, largura_cm = 25, comprimento_cm = 35
where not (categorias @> '["bermuda"]'::jsonb)
  and (lower(nome) like '%dry fit%' or lower(nome) like '%dryfit%' or lower(nome) like '%poliamida%');

-- Estonada — 0,28kg · 3×27×37cm
update produtos
set peso_kg = 0.28, altura_cm = 3, largura_cm = 27, comprimento_cm = 37
where not (categorias @> '["bermuda"]'::jsonb)
  and lower(nome) like '%estonada%';

-- Oversized / suedine — 0,35kg · 4×30×40cm
update produtos
set peso_kg = 0.35, altura_cm = 4, largura_cm = 30, comprimento_cm = 40
where not (categorias @> '["bermuda"]'::jsonb)
  and (lower(nome) like '%oversized%' or lower(nome) like '%suedine%');

-- Polo — 0,32kg · 4×27×37cm
update produtos
set peso_kg = 0.32, altura_cm = 4, largura_cm = 27, comprimento_cm = 37
where not (categorias @> '["bermuda"]'::jsonb)
  and lower(nome) like '%polo%';
