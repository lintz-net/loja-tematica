-- Rode isto no SQL Editor do Supabase.
-- Cupons de desconto pro checkout — CRUD no admin, validação real feita numa Edge Function
-- (service_role), nunca direto pelo navegador: expor a tabela pra leitura por `anon`
-- deixaria qualquer um listar todos os códigos/percentuais ativos.

create table if not exists cupons (
  codigo text primary key,
  tipo_desconto text not null check (tipo_desconto in ('percentual', 'valor_fixo')),
  valor_desconto numeric not null check (valor_desconto > 0),
  expira_em timestamptz, -- null = nunca expira
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table cupons enable row level security;

-- Só admin lê/escreve — a validação no checkout passa pela Edge Function `validar-cupom`
-- (service_role, ignora RLS), não por select direto do `anon`.
create policy "Admin pode ler cupons"
  on cupons for select
  to authenticated
  using (eh_admin());

create policy "Admin pode inserir cupons"
  on cupons for insert
  to authenticated
  with check (eh_admin());

create policy "Admin pode atualizar cupons"
  on cupons for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());

create policy "Admin pode deletar cupons"
  on cupons for delete
  to authenticated
  using (eh_admin());

-- Guarda qual cupom foi usado em cada pedido (auditoria/histórico) — nullable, pedidos sem
-- cupom continuam funcionando normalmente.
alter table pedidos
  add column if not exists cupom_codigo text,
  add column if not exists valor_desconto numeric;
