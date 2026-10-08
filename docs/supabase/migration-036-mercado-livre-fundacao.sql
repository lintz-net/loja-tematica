-- Rode isto no SQL Editor do Supabase.
--
-- Fase 0 da integração Supabase ↔ Mercado Livre (ver TODO.md, seção "Integração Supabase ↔
-- Mercado Livre"). Cria as dez tabelas da arquitetura (nomes em português, mesmo padrão do
-- resto do schema) + a função de estoque atômico multicanal. Nada aqui fala com a API do
-- Mercado Livre ainda — isso é só a fundação (banco), sem Edge Function nenhuma. OAuth,
-- publicação de anúncio, sincronização de preço/estoque e processamento de pedido são as
-- próximas fases.
--
-- `estoque_sku` é a nova fonte de verdade de estoque POR CANAL DE VENDA (multicanal) — não
-- substitui `produtos.variantes[].quantidadeEstoque`, que continua existindo e sendo o que
-- `/admin/produtos` edita diretamente. A ideia é que, quando a integração estiver completa,
-- `estoque_sku` vire a fonte de verdade de verdade (editada via `reservar_estoque`
-- /`liberar_estoque`, nunca por update direto) e `produtos.variantes[].quantidadeEstoque`
-- passe a ser só um espelho dela — essa migração de fonte de verdade é posterior (Fase 2),
-- aqui só criamos a estrutura e semeamos com o estoque atual.

-- 1. estoque_sku — saldo por SKU, fonte da verdade multicanal.
create table if not exists estoque_sku (
  sku text primary key,
  produto_id text references produtos(id),
  quantidade integer not null default 0 check (quantidade >= 0),
  atualizado_em timestamptz not null default now()
);

-- 2. movimentos_estoque — histórico + idempotência (reservar/liberar nunca aplicam duas vezes
-- o mesmo movimento, graças ao unique abaixo).
create table if not exists movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  sku text not null references estoque_sku(sku),
  delta integer not null,
  tipo text not null check (tipo in ('venda', 'cancelamento', 'ajuste', 'reposicao')),
  canal text not null,
  referencia text not null,
  criado_em timestamptz not null default now(),
  unique (canal, referencia, sku, tipo)
);

-- 3. anuncios_canais — mapeamento SKU -> anúncio, por canal (ml, shopee, whatsapp...).
create table if not exists anuncios_canais (
  id uuid primary key default gen_random_uuid(),
  sku text not null references estoque_sku(sku),
  canal text not null,
  anuncio_id_remoto text,
  variacao_id_remoto text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicando', 'ativo', 'pausado', 'invalido', 'encerrado')),
  status_remoto text,
  ultimo_erro text,
  ultima_sincronizacao_em timestamptz,
  buffer_seguranca integer not null default 0,
  hash_payload text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_anuncios_canais_sku on anuncios_canais (sku);
create index if not exists idx_anuncios_canais_remoto
  on anuncios_canais (canal, anuncio_id_remoto, variacao_id_remoto);

-- 4. credenciais_mercado_livre — tokens OAuth. Sem policy nenhuma de RLS (nem pra
-- authenticated/admin) — acesso só via service_role, nunca exposto pelo painel diretamente.
create table if not exists credenciais_mercado_livre (
  seller_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expira_em timestamptz not null,
  status text not null default 'ok' check (status in ('ok', 'requer_reautenticacao')),
  atualizado_em timestamptz not null default now()
);

-- 5. estados_oauth_mercado_livre — state temporário do fluxo OAuth (PKCE), expira em 10min.
create table if not exists estados_oauth_mercado_livre (
  state text primary key,
  code_verifier text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);

-- 6. categorias_mercado_livre — cache de categoria + atributos do ML (validade de 7 dias,
-- controlada em código, não aqui).
create table if not exists categorias_mercado_livre (
  category_id text primary key,
  atributos jsonb not null,
  buscado_em timestamptz not null default now()
);

-- 7. mapeamentos_atributos_mercado_livre — de onde vem o valor de cada atributo obrigatório
-- de uma categoria do ML: campo do produto (campo_origem) ou valor fixo (valor_fixo).
create table if not exists mapeamentos_atributos_mercado_livre (
  id uuid primary key default gen_random_uuid(),
  categoria_interna_id text not null,
  ml_categoria_id text not null,
  atributo_id text not null,
  campo_origem text,
  valor_fixo text,
  criado_em timestamptz not null default now()
);

-- 8. fila_sincronizacao — fila de jobs compartilhada pelos três fluxos (saída, entrada,
-- reconciliação). Índice único parcial coalesce pushes repetidos do mesmo anúncio: só pode
-- existir um job pendente por (tipo, anuncio_id) de cada vez.
create table if not exists fila_sincronizacao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  canal text not null,
  anuncio_id uuid references anuncios_canais(id),
  payload jsonb,
  status text not null default 'pendente'
    check (status in ('pendente', 'executando', 'concluido', 'falhou', 'morto')),
  tentativas integer not null default 0,
  max_tentativas integer not null default 8,
  executar_apos timestamptz not null default now(),
  travado_em timestamptz,
  ultimo_erro text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_fila_sincronizacao_pendentes
  on fila_sincronizacao (status, executar_apos);
create unique index if not exists idx_fila_sincronizacao_coalesce
  on fila_sincronizacao (tipo, anuncio_id)
  where status = 'pendente';

-- 9. eventos_webhook_mercado_livre — notificações recebidas, com dedupe (mesmo padrão de
-- eventos_webhook_melhor_envio/eventos_webhook_mercado_pago).
create table if not exists eventos_webhook_mercado_livre (
  id uuid primary key default gen_random_uuid(),
  topico text not null,
  recurso text not null,
  user_id text,
  status text not null default 'recebido'
    check (status in ('recebido', 'processado', 'ignorado', 'falhou')),
  bruto jsonb not null,
  recebido_em timestamptz not null default now()
);

-- 10. pedidos_mercado_livre — pedidos recebidos do ML. `bruto` guarda o JSON cru (fonte da
-- verdade pro worker, nunca confia só no que veio da notificação). `precisa_atencao` marca
-- sobrevenda/SKU não mapeado pro admin decidir manualmente.
create table if not exists pedidos_mercado_livre (
  order_id text primary key,
  status text not null,
  estoque_aplicado boolean not null default false,
  precisa_atencao boolean not null default false,
  bruto jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Flag de pausa global — desliga o processamento da fila do ML sem perder os jobs (ex.:
-- durante um requer_reautenticacao), igual ao padrão de linha única de configuracao_loja.
create table if not exists configuracao_integracoes (
  id text primary key default 'integracoes',
  mercado_livre_habilitado boolean not null default true
);
insert into configuracao_integracoes (id, mercado_livre_habilitado)
values ('integracoes', true)
on conflict (id) do nothing;

-- RLS: todas ativas, SEM policy nenhuma por enquanto (nem admin) — tudo aqui só é lido/escrito
-- por service_role (Edge Functions), que ignora RLS. Policies de leitura pro painel admin
-- (/admin/integracoes) entram na Fase 4, quando o painel existir de verdade.
alter table estoque_sku enable row level security;
alter table movimentos_estoque enable row level security;
alter table anuncios_canais enable row level security;
alter table credenciais_mercado_livre enable row level security;
alter table estados_oauth_mercado_livre enable row level security;
alter table categorias_mercado_livre enable row level security;
alter table mapeamentos_atributos_mercado_livre enable row level security;
alter table fila_sincronizacao enable row level security;
alter table eventos_webhook_mercado_livre enable row level security;
alter table pedidos_mercado_livre enable row level security;
alter table configuracao_integracoes enable row level security;

-- Semeia estoque_sku com o estoque atual de cada variação do catálogo (quantidadeEstoque em
-- produtos.variantes, chave sku). Só roda uma vez (on conflict do nothing) — se já existir
-- linha, mantém (evita sobrescrever ajustes feitos depois dessa migração rodar).
insert into estoque_sku (sku, produto_id, quantidade)
select
  variante->>'sku' as sku,
  produtos.id as produto_id,
  coalesce((variante->>'quantidadeEstoque')::integer, 0) as quantidade
from produtos, jsonb_array_elements(produtos.variantes) as variante
where variante->>'sku' is not null
on conflict (sku) do nothing;

-- Função de baixa de estoque atômica e idempotente. `security definer` pra poder ser chamada
-- via RPC pelo checkout (role anon) sem dar acesso de update direto na tabela a ela.
create or replace function reservar_estoque(
  p_sku text,
  p_quantidade integer,
  p_canal text,
  p_referencia text
)
returns table(ok boolean, nova_quantidade integer)
language plpgsql
security definer
as $$
begin
  -- idempotência: a mesma venda (canal+referencia+sku) processada de novo não baixa duas vezes.
  if exists (
    select 1 from movimentos_estoque
    where canal = p_canal and referencia = p_referencia and sku = p_sku and tipo = 'venda'
  ) then
    return query select true, (select quantidade from estoque_sku where sku = p_sku);
    return;
  end if;

  update estoque_sku
     set quantidade = quantidade - p_quantidade, atualizado_em = now()
   where sku = p_sku and quantidade >= p_quantidade
  returning true, quantidade into ok, nova_quantidade;

  if not found then
    return query select false, (select quantidade from estoque_sku where sku = p_sku);
    return;
  end if;

  insert into movimentos_estoque (sku, delta, tipo, canal, referencia)
  values (p_sku, -p_quantidade, 'venda', p_canal, p_referencia);

  return next;
end;
$$;

-- Inverso de reservar_estoque — só devolve se existir a baixa correspondente (não cria
-- estoque do nada por engano num cancelamento duplicado ou de uma venda que nunca existiu).
create or replace function liberar_estoque(
  p_sku text,
  p_quantidade integer,
  p_canal text,
  p_referencia text
)
returns table(ok boolean, nova_quantidade integer)
language plpgsql
security definer
as $$
begin
  if exists (
    select 1 from movimentos_estoque
    where canal = p_canal and referencia = p_referencia and sku = p_sku and tipo = 'cancelamento'
  ) then
    return query select true, (select quantidade from estoque_sku where sku = p_sku);
    return;
  end if;

  if not exists (
    select 1 from movimentos_estoque
    where canal = p_canal and referencia = p_referencia and sku = p_sku and tipo = 'venda'
  ) then
    return query select false, (select quantidade from estoque_sku where sku = p_sku);
    return;
  end if;

  update estoque_sku
     set quantidade = quantidade + p_quantidade, atualizado_em = now()
   where sku = p_sku
  returning true, quantidade into ok, nova_quantidade;

  insert into movimentos_estoque (sku, delta, tipo, canal, referencia)
  values (p_sku, p_quantidade, 'cancelamento', p_canal, p_referencia);

  return next;
end;
$$;

-- Checkout da loja chama essas duas via RPC com a chave anon (reserva antes de confirmar
-- pagamento, libera se o pagamento falhar/expirar) — sem isso o Postgres nega a execução por
-- padrão, mesmo sendo security definer (mesmo padrão de obter_pedido_por_codigo).
grant execute on function reservar_estoque(text, integer, text, text) to anon;
grant execute on function liberar_estoque(text, integer, text, text) to anon;
