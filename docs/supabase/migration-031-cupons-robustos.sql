-- Rode isto no SQL Editor do Supabase.
--
-- Contexto (2026-10-03): cupom até aqui só tinha código/tipo/valor/validade — decisão do
-- usuário foi adicionar valor mínimo de pedido, limite de uso por cliente (por e-mail, não
-- exige login — checkout não obriga conta) e restrição por categoria/produto (desconto incide
-- só nos itens do carrinho que batem com a regra, não no pedido inteiro — ver
-- `validar-cupom`, reescrita pra calcular isso).
--
-- Todas as colunas são opcionais (null = sem essa restrição) — cupom antigo sem nenhuma
-- dessas colunas preenchida continua funcionando exatamente como antes (desconto no carrinho
-- inteiro, sem mínimo, sem limite de uso).

alter table cupons
  add column if not exists valor_minimo_pedido numeric,
  add column if not exists limite_uso_por_email integer,
  add column if not exists categorias text[],
  add column if not exists produtos_ids text[];
