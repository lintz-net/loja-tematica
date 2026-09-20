-- Rode isto no SQL Editor do Supabase.
-- Banners ganham CRUD no admin (antes só existiam via inserção manual no Supabase) e um
-- campo de destino: 'home' (carrossel da página inicial, comportamento de sempre) ou 'menu'
-- (banner promocional dentro do mega-menu "Produtos" do cabeçalho). Pode haver vários banners
-- com destino='menu' — o mega-menu sempre usa o de maior `ordem`.

-- `id` nunca teve default (banners sempre foram inseridos manualmente com id explícito) —
-- o novo admin de banners não informa id, então precisa gerar sozinho.
alter table banners alter column id set default gen_random_uuid()::text;

alter table banners
  add column if not exists destino text not null default 'home';

alter table banners
  add constraint banners_destino_check check (destino in ('home', 'menu'));

alter table banners enable row level security;

create policy "banners_select_publico" on banners for select using (true);
create policy "banners_admin_insert" on banners for insert with check (eh_admin());
create policy "banners_admin_update" on banners for update using (eh_admin()) with check (eh_admin());
create policy "banners_admin_delete" on banners for delete using (eh_admin());

-- Bucket de Storage pras imagens de banner (CRUD de banner nunca existiu antes — só dava
-- pra inserir direto no Supabase). Mesmo padrão do bucket "produtos" (migration-005): público
-- pra leitura, só autenticado (admin) escreve.
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "Leitura publica de imagens de banner"
  on storage.objects for select
  to public
  using (bucket_id = 'banners');

create policy "Admin pode enviar imagens de banner"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'banners');

create policy "Admin pode atualizar imagens de banner"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'banners');

create policy "Admin pode deletar imagens de banner"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'banners');
