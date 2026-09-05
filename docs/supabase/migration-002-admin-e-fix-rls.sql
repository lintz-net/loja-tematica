-- Rode isto no SQL Editor do Supabase (você já rodou o schema.sql original antes).
-- Corrige uma falha: a policy de select antiga liberava a tabela pedidos inteira pra
-- qualquer um com a chave anônima. Substitui por uma função que só expõe o pedido cujo
-- código o cliente já informou, e adiciona acesso de admin (autenticado) pra listar/mudar
-- status de qualquer pedido.

drop policy if exists "Qualquer um pode ler pedido pelo codigo" on pedidos;

create policy "Admin pode ler todos os pedidos"
  on pedidos for select
  to authenticated
  using (true);

create policy "Admin pode atualizar pedidos"
  on pedidos for update
  to authenticated
  using (true)
  with check (true);

create or replace function obter_pedido_por_codigo(p_codigo text)
returns setof pedidos
language sql
security definer
set search_path = public
as $$
  select * from pedidos where codigo = p_codigo;
$$;

grant execute on function obter_pedido_por_codigo(text) to anon;
