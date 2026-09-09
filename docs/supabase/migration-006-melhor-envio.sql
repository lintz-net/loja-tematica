-- Rode isto no SQL Editor do Supabase.
-- Integração com o Melhor Envio: tokens OAuth, envios/etiquetas, log de webhooks, e
-- peso/dimensões nos produtos (necessários pra cotação de frete).

-- 1) Peso e dimensões por produto (unidade), usados na cotação de frete.
alter table produtos
  add column if not exists peso_kg numeric,
  add column if not exists altura_cm numeric,
  add column if not exists largura_cm numeric,
  add column if not exists comprimento_cm numeric;

-- 2) Tokens OAuth do Melhor Envio — uma linha por ambiente ('sandbox' | 'producao').
-- RLS habilitado SEM nenhuma policy: nem anon nem authenticated têm qualquer acesso: só a
-- service_role (usada pelas Edge Functions) enxerga essa tabela, já que ela ignora RLS.
create table if not exists tokens_melhor_envio (
  ambiente text primary key check (ambiente in ('sandbox', 'producao')),
  access_token text not null,
  refresh_token text not null,
  expira_em timestamptz not null,
  atualizado_em timestamptz not null default now()
);

alter table tokens_melhor_envio enable row level security;

-- 3) Envios/etiquetas — um por pedido.
create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  codigo_pedido text not null unique references pedidos(codigo),
  transportadora text,
  servico_nome text,
  servico_id_melhor_envio text,
  prazo_dias integer,
  valor_frete numeric,
  id_melhor_envio text, -- id do envio/carrinho no Melhor Envio (usado pra comprar/rastrear)
  codigo_rastreio text,
  url_etiqueta text,
  status_envio text not null default 'aguardando_compra' check (
    status_envio in (
      'aguardando_compra', -- ainda não comprou a etiqueta
      'pendente_etiqueta', -- tentou comprar e falhou (saldo insuficiente, erro da API) — ação manual do admin
      'criado',
      'pendente',
      'liberado',
      'gerado',
      'postado',
      'entregue',
      'nao_entregue',
      'pausado',
      'suspenso',
      'cancelado'
    )
  ),
  erro_compra_etiqueta text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table envios enable row level security;

-- Admin (autenticado) pode ler/gerenciar todos os envios (painel /admin/pedidos vai
-- mostrar o status de envio e permitir comprar etiqueta manualmente).
create policy "Admin pode ler todos os envios"
  on envios for select
  to authenticated
  using (true);

create policy "Admin pode inserir envios"
  on envios for insert
  to authenticated
  with check (true);

create policy "Admin pode atualizar envios"
  on envios for update
  to authenticated
  using (true)
  with check (true);

-- Rastreio público por código de pedido (mesmo padrão de obter_pedido_por_codigo): função
-- SECURITY DEFINER em vez de policy de select direta, pra não abrir a tabela toda pra quem
-- tem só a chave anônima.
create or replace function obter_envio_por_codigo_pedido(p_codigo_pedido text)
returns setof envios
language sql
security definer
set search_path = public
as $$
  select * from envios where codigo_pedido = p_codigo_pedido;
$$;

grant execute on function obter_envio_por_codigo_pedido(text) to anon;

-- Habilita Realtime na tabela envios, pra página de acompanhamento atualizar sozinha
-- quando o status do envio mudar (webhook do Melhor Envio → Edge Function → update aqui).
alter publication supabase_realtime add table envios;

-- 4) Log de eventos recebidos do webhook do Melhor Envio — só admin lê, só service_role
-- escreve (a Edge Function do webhook usa a service_role key, que ignora RLS).
create table if not exists eventos_webhook_melhor_envio (
  id uuid primary key default gen_random_uuid(),
  tipo_evento text not null,
  id_melhor_envio text,
  payload jsonb not null,
  recebido_em timestamptz not null default now()
);

alter table eventos_webhook_melhor_envio enable row level security;

create policy "Admin pode ler eventos de webhook"
  on eventos_webhook_melhor_envio for select
  to authenticated
  using (true);
