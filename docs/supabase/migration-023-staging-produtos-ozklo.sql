-- Rode isto no SQL Editor do Supabase.
-- Tabela de staging pra importação do catálogo da OZKLO (fornecedor autorizado) — guarda o
-- dado raspado bruto e um vínculo opcional com o produto real (`produtos.id`), separado da
-- tabela `produtos` em si. Isso permite reraspagem idempotente (o script de import faz
-- upsert nessa tabela por `url_origem`, que não muda entre execuções, ao contrário do nome
-- do produto) e permite o admin vincular manualmente uma linha da staging a um produto já
-- existente pra evitar duplicata semântica (mesmo produto físico, nome diferente na loja),
-- ex.:
--
--   update staging_produtos_ozklo set produto_id = 'prod-16'
--   where url_origem = 'https://www.ozklo.com.br/produtos/camiseta-coyote';
--
-- Na próxima rodada do import, essa linha vai ser tratada como "já vinculada" — o script
-- atualiza preço/estoque/imagens novas do produto existente em vez de criar um segundo.

create table if not exists staging_produtos_ozklo (
  id uuid primary key default gen_random_uuid(),
  url_origem text not null unique,
  dados jsonb not null, -- payload cru do scraper: nome, descricao, precoBase, variantes, categoriasSugeridas, imagens etc.
  produto_id text references produtos(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'importado', 'ignorado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists staging_produtos_ozklo_produto_id_idx on staging_produtos_ozklo(produto_id);

create or replace function staging_produtos_ozklo_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_staging_produtos_ozklo_atualizado_em on staging_produtos_ozklo;
create trigger trg_staging_produtos_ozklo_atualizado_em
  before update on staging_produtos_ozklo
  for each row
  execute function staging_produtos_ozklo_set_atualizado_em();

alter table staging_produtos_ozklo enable row level security;

create policy "Admin gerencia staging da importação OZKLO"
  on staging_produtos_ozklo for all
  to authenticated
  using (eh_admin())
  with check (eh_admin());
