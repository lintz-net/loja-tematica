-- Rode isto no SQL Editor do Supabase.
-- Cria o bucket de Storage pras imagens de produtos e libera insert/update/delete nas
-- tabelas de catálogo pra admins autenticados (hoje só liberava select).

-- Bucket público (qualquer um lê, só autenticado escreve) pras fotos de produtos.
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

create policy "Leitura publica de imagens de produtos"
  on storage.objects for select
  to public
  using (bucket_id = 'produtos');

create policy "Admin pode enviar imagens de produtos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos');

create policy "Admin pode atualizar imagens de produtos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'produtos');

create policy "Admin pode deletar imagens de produtos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos');

-- Admin (autenticado) agora pode criar/editar/remover produtos e categorias — antes só
-- select era liberado (catálogo era só leitura, sem tela de gestão).
create policy "Admin pode inserir produtos"
  on produtos for insert
  to authenticated
  with check (true);

create policy "Admin pode atualizar produtos"
  on produtos for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin pode deletar produtos"
  on produtos for delete
  to authenticated
  using (true);

create policy "Admin pode inserir categorias"
  on categorias for insert
  to authenticated
  with check (true);

create policy "Admin pode atualizar categorias"
  on categorias for update
  to authenticated
  using (true)
  with check (true);
