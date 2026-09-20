-- Rode isto no SQL Editor do Supabase.
-- Avaliações/depoimentos de clientes, cadastrados manualmente pelo admin (sem formulário
-- público de submissão nem verificação de compra) — princípio do projeto é só exibir
-- depoimentos reais, nunca inventados. produto_id é opcional (avaliação pode ser geral, sem
-- vincular a um produto específico) e usa `text` porque produtos.id é text, não uuid.

create table avaliacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id text null references produtos(id) on delete set null,
  nome_cliente text not null,
  nota smallint not null check (nota between 1 and 5),
  comentario text null,
  criado_em timestamptz not null default now()
);
create index on avaliacoes(produto_id);

alter table avaliacoes enable row level security;

create policy "avaliacoes_select_publico" on avaliacoes for select using (true);
create policy "avaliacoes_admin_insert" on avaliacoes for insert with check (eh_admin());
create policy "avaliacoes_admin_update" on avaliacoes for update using (eh_admin()) with check (eh_admin());
create policy "avaliacoes_admin_delete" on avaliacoes for delete using (eh_admin());
