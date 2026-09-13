-- Rode isto no SQL Editor do Supabase.
-- Configuração de identidade da loja (nome, contato, redes sociais) — hoje hardcoded em
-- vários componentes (SeoService, rodapé, WhatsApp flutuante, admin-shell). Movido pra cá
-- pra permitir reaproveitar o mesmo código-fonte em outra loja temática só trocando o
-- conteúdo desta tabela (cada loja tem seu próprio projeto Supabase), sem editar/recompilar
-- nada. Linha única (singleton) — id fixo 'loja'.

create table if not exists configuracao_loja (
  id text primary key default 'loja' check (id = 'loja'),
  nome_loja text not null,
  descricao_padrao text not null,
  email_contato text not null,
  whatsapp_numero text not null, -- só dígitos, com DDI e DDD, ex.: 5519991354644
  whatsapp_mensagem text not null,
  instagram_url text,
  tiktok_url text,
  atualizado_em timestamptz not null default now()
);

alter table configuracao_loja enable row level security;

create policy "Qualquer um pode ler a configuracao da loja"
  on configuracao_loja for select
  to anon, authenticated
  using (true);

-- eh_admin() já existe desde migration-010-controle-admin.sql
create policy "Admin pode atualizar a configuracao da loja"
  on configuracao_loja for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());

insert into configuracao_loja (
  id, nome_loja, descricao_padrao, email_contato, whatsapp_numero, whatsapp_mensagem,
  instagram_url, tiktok_url
) values (
  'loja',
  'Vista Nostálgica',
  'Camisetas, bermudas e polos com estampas que remetem a games, cinema, música, futebol, carros e humor.',
  'contato@vistanostalgica.com.br',
  '5519991354644',
  'Olá! Preciso de ajuda com um produto da Vista Nostálgica.',
  null,
  null
)
on conflict (id) do nothing;
