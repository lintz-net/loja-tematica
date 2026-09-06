-- Rode isto no SQL Editor do Supabase.
-- Cria as tabelas do catálogo (categorias, produtos, banners) — dados públicos, sem RLS
-- restritiva de leitura (qualquer um pode listar produtos), mas sem policy de
-- insert/update/delete pra ninguém: por enquanto o catálogo só é alterado via SQL direto
-- (sem tela de admin de produtos ainda).

create table if not exists categorias (
  id text primary key,
  nome text not null,
  slug text not null unique,
  cor_tema text not null,
  descricao_curta text not null,
  icone text not null
);

create table if not exists produtos (
  id text primary key,
  nome text not null,
  slug text not null unique,
  descricao text not null,
  preco_base numeric not null,
  categorias jsonb not null, -- array de slugs de categoria, ex.: ["geek", "cinema"]
  imagens jsonb not null, -- array de caminhos, ex.: ["/imagens/produtos/foo/foto_01.webp"]
  imagens_por_cor jsonb, -- objeto { "Preto": ["/imagens/..."], ... }, opcional
  guia_medidas jsonb, -- array de { tamanho, larguraCm, comprimentoCm }, opcional
  variantes jsonb not null -- array de { id, produtoId, sku, tamanho, cor, quantidadeEstoque, precoOverride }
);

create table if not exists banners (
  id text primary key,
  imagem_url text not null,
  alt text not null,
  link text,
  ordem integer not null default 0
);

alter table categorias enable row level security;
alter table produtos enable row level security;
alter table banners enable row level security;

create policy "Qualquer um pode ler categorias" on categorias for select to anon, authenticated using (true);
create policy "Qualquer um pode ler produtos" on produtos for select to anon, authenticated using (true);
create policy "Qualquer um pode ler banners" on banners for select to anon, authenticated using (true);
