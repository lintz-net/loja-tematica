-- Rode isto no SQL Editor do Supabase.
-- Curadoria manual de produtos na home: destaque (com ordem manual opcional) e preço
-- promocional (quando menor que o preço base, o produto entra no carrossel de ofertas).

alter table produtos
  add column if not exists destaque boolean not null default false,
  add column if not exists ordem_destaque integer null,
  add column if not exists preco_promocional numeric(10,2) null;

alter table produtos
  add constraint produtos_preco_promocional_check
  check (preco_promocional is null or preco_promocional < preco_base);
