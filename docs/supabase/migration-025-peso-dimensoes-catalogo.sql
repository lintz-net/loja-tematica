-- Rode isto no SQL Editor do Supabase.
-- Preenche peso/dimensões pra todo o catálogo (produtos.peso_kg/altura_cm/largura_cm/
-- comprimento_cm), hoje em branco — sem isso a cotação de frete usa um valor genérico
-- (0,3kg, 20×5×25cm) até o admin preencher os reais (ver TODO.md).
--
-- Peso/dimensões são salvos por PRODUTO, não por tamanho — e a maioria dos produtos do
-- catálogo mistura P/M/G com GG/G1/G2/XG na mesma ficha (ex.: "Camiseta Naruto" tem G, GG e
-- M juntos). Como não dá pra guardar dois pesos diferentes pro mesmo produto hoje, usa
-- sempre o peso do MAIOR tamanho presente — nunca subestima o frete (o risco real: cobrar de
-- menos e a loja arcar com a diferença), só superestima levemente quando um P/M/G é comprado
-- sozinho de um produto que também tem GG.
--
-- Valores fornecidos pelo usuário (2026-09-25):
--   P/M/G:            0,25kg · 3×25×35cm (altura×largura×comprimento)
--   GG/G1/G2/XG:      0,30kg · 3×27×37cm
--
-- `where peso_kg is null` em ambos os UPDATEs: só preenche o que está em branco, nunca
-- sobrescreve um valor que o admin já tenha ajustado manualmente em `/admin/produtos`.

update produtos
set
  peso_kg = 0.30,
  altura_cm = 3,
  largura_cm = 27,
  comprimento_cm = 37
where peso_kg is null
  and exists (
    select 1 from jsonb_array_elements(variantes) v
    where (v->>'tamanho') in ('GG', 'G1', 'G2', 'XG')
  );

update produtos
set
  peso_kg = 0.25,
  altura_cm = 3,
  largura_cm = 25,
  comprimento_cm = 35
where peso_kg is null
  and not exists (
    select 1 from jsonb_array_elements(variantes) v
    where (v->>'tamanho') in ('GG', 'G1', 'G2', 'XG')
  );
