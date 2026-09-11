-- Rode isto no SQL Editor do Supabase.
-- "Avise-me quando chegar" — cliente deixa o e-mail numa variante sem estoque; quando o
-- admin repõe o estoque dela (Edge Function `notificar-estoque`, chamada pelo admin ao
-- salvar o produto), todo mundo que se inscreveu recebe um e-mail e o registro é marcado
-- como notificado.

create table if not exists avisos_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id text not null references produtos(id) on delete cascade,
  variante_id text not null,
  produto_nome text not null,
  produto_slug text not null,
  tamanho text not null,
  cor text not null,
  email text not null,
  criado_em timestamptz not null default now(),
  notificado boolean not null default false,
  notificado_em timestamptz
);

alter table avisos_estoque enable row level security;

-- Qualquer visitante pode se inscrever (sem login) — captura pura, sem select/update/delete
-- liberado pro público (só a service_role, usada pela Edge Function, gerencia o resto).
create policy "Qualquer um pode se inscrever pra aviso de estoque"
  on avisos_estoque for insert
  to anon, authenticated
  with check (true);

create policy "Admin pode ler avisos de estoque"
  on avisos_estoque for select
  to authenticated
  using (eh_admin());
