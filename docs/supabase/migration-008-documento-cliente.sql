-- Rode isto no SQL Editor do Supabase.
-- CPF/CNPJ do cliente, coletado no checkout — exigido pelo Melhor Envio pra gerar a etiqueta
-- (destinatário do envio). Nullable porque pedidos antigos não têm esse dado.

alter table pedidos
  add column if not exists documento_cliente text;
