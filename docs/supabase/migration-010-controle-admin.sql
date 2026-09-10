-- Rode isto no SQL Editor do Supabase (ou via `supabase db query --linked -f`).
--
-- ⚠️ Corrige uma falha de segurança real: toda policy de admin até agora usava
-- `to authenticated using (true)` — ou seja, QUALQUER usuário autenticado no Supabase Auth
-- (não só o admin) tinha acesso de admin: ler todos os pedidos com dados pessoais de
-- clientes, mudar status, criar/editar/apagar produtos e categorias, ler/escrever `envios` e
-- o log de webhooks, e subir/apagar imagens no bucket `produtos`. Isso nunca foi explorado
-- porque só existia uma conta (a do admin) no projeto, mas ia virar um problema real assim
-- que login de cliente (magic link) fosse implementado — qualquer cliente que criasse conta
-- ganharia acesso total ao painel admin.
--
-- Introduz uma tabela `admins` (RLS sem nenhuma policy — só gerenciável via SQL
-- Editor/service_role) e uma função `eh_admin()` (SECURITY DEFINER) que checa se o usuário
-- da sessão atual está nela. Toda policy que antes usava `using (true)` pra `authenticated`
-- passa a usar `using (eh_admin())`.

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table admins enable row level security;

-- Admin atual (lintz.net@gmail.com) — único admin da loja até aqui.
insert into admins (user_id) values ('10d88f02-637c-4abe-9c15-424d38db5c6f')
on conflict do nothing;

create or replace function eh_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

grant execute on function eh_admin() to authenticated;

-- pedidos ------------------------------------------------------------------

drop policy if exists "Admin pode ler todos os pedidos" on pedidos;
create policy "Admin pode ler todos os pedidos"
  on pedidos for select
  to authenticated
  using (eh_admin());

drop policy if exists "Admin pode atualizar pedidos" on pedidos;
create policy "Admin pode atualizar pedidos"
  on pedidos for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());

-- Cliente autenticado (login por e-mail via magic link) pode ler os próprios pedidos —
-- casado pelo e-mail da sessão, sem abrir a tabela toda. Convive com a policy de admin
-- acima (RLS combina policies permissivas com OR).
create policy "Cliente pode ler os proprios pedidos"
  on pedidos for select
  to authenticated
  using (lower(email_cliente) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- produtos / categorias ------------------------------------------------------

drop policy if exists "Admin pode inserir produtos" on produtos;
create policy "Admin pode inserir produtos"
  on produtos for insert
  to authenticated
  with check (eh_admin());

drop policy if exists "Admin pode atualizar produtos" on produtos;
create policy "Admin pode atualizar produtos"
  on produtos for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());

drop policy if exists "Admin pode deletar produtos" on produtos;
create policy "Admin pode deletar produtos"
  on produtos for delete
  to authenticated
  using (eh_admin());

drop policy if exists "Admin pode inserir categorias" on categorias;
create policy "Admin pode inserir categorias"
  on categorias for insert
  to authenticated
  with check (eh_admin());

drop policy if exists "Admin pode atualizar categorias" on categorias;
create policy "Admin pode atualizar categorias"
  on categorias for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());

-- Storage: bucket "produtos" --------------------------------------------------

drop policy if exists "Admin pode enviar imagens de produtos" on storage.objects;
create policy "Admin pode enviar imagens de produtos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos' and eh_admin());

drop policy if exists "Admin pode atualizar imagens de produtos" on storage.objects;
create policy "Admin pode atualizar imagens de produtos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'produtos' and eh_admin());

drop policy if exists "Admin pode deletar imagens de produtos" on storage.objects;
create policy "Admin pode deletar imagens de produtos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos' and eh_admin());

-- envios / eventos_webhook_melhor_envio ---------------------------------------

drop policy if exists "Admin pode ler todos os envios" on envios;
create policy "Admin pode ler todos os envios"
  on envios for select
  to authenticated
  using (eh_admin());

drop policy if exists "Admin pode inserir envios" on envios;
create policy "Admin pode inserir envios"
  on envios for insert
  to authenticated
  with check (eh_admin());

drop policy if exists "Admin pode atualizar envios" on envios;
create policy "Admin pode atualizar envios"
  on envios for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());

drop policy if exists "Admin pode ler eventos de webhook" on eventos_webhook_melhor_envio;
create policy "Admin pode ler eventos de webhook"
  on eventos_webhook_melhor_envio for select
  to authenticated
  using (eh_admin());
