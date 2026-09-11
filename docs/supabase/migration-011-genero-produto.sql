-- Rode isto no SQL Editor do Supabase.
-- Determina qual tabela padrão de medidas mostrar no "Guia de medidas" quando o produto não
-- tem uma tabela customizada (`guia_medidas`) — masculina/unissex (corte tradicional) ou
-- feminina (baby look). Nullable/default 'unissex': produtos antigos, sem essa coluna
-- preenchida, caem na tabela masculina/unissex (mesmo comportamento de antes).

alter table produtos
  add column if not exists genero text check (genero in ('masculino', 'feminino', 'unissex')) default 'unissex';
