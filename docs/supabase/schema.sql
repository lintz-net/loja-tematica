-- Rode isto no SQL Editor do Supabase (Project > SQL Editor > New query).

create table if not exists pedidos (
  codigo text primary key,
  criado_em timestamptz not null default now(),
  status text not null default 'recebido' check (status in ('recebido', 'confirmado', 'enviado', 'entregue')),
  nome_cliente text not null,
  email_cliente text not null,
  telefone_cliente text not null,
  endereco jsonb not null,
  itens jsonb not null,
  forma_pagamento text not null check (forma_pagamento in ('cartao', 'pix')),
  parcelas integer not null default 1,
  valor_frete numeric not null,
  valor_total numeric not null
);

alter table pedidos enable row level security;

-- Qualquer pessoa pode criar um pedido (checkout público, sem login) — inclui
-- 'authenticated' também porque um admin logado no navegador precisa poder testar/fazer
-- uma compra normalmente, sem ser bloqueado por não ter policy de insert pro seu papel.
create policy "Qualquer um pode inserir pedidos"
  on pedidos for insert
  to anon, authenticated
  with check (true);

-- Administradores autenticados (painel /admin) podem ler e atualizar qualquer pedido —
-- usado pra listar pedidos e mudar o status (recebido/confirmado/enviado/entregue).
create policy "Admin pode ler todos os pedidos"
  on pedidos for select
  to authenticated
  using (true);

create policy "Admin pode atualizar pedidos"
  on pedidos for update
  to authenticated
  using (true)
  with check (true);

-- Rastreio público por código NÃO usa policy de select direta (isso vazaria a tabela
-- inteira pra qualquer um com a chave anônima, já que RLS não filtra pelo argumento da
-- query). Em vez disso, uma função com SECURITY DEFINER expõe só o pedido cujo código o
-- cliente já conhece, sem dar acesso de leitura à tabela toda.
create or replace function obter_pedido_por_codigo(p_codigo text)
returns setof pedidos
language sql
security definer
set search_path = public
as $$
  select * from pedidos where codigo = p_codigo;
$$;

grant execute on function obter_pedido_por_codigo(text) to anon;
