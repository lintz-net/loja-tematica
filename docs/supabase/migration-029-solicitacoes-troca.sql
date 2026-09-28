-- Rode isto no SQL Editor do Supabase.
--
-- Contexto (2026-09-28): troca/devolução até aqui só existia por e-mail (cliente escreve pra
-- {{emailContato}}, sem nenhum registro estruturado). Cria uma tabela pra deixar isso
-- self-service em /conta: cliente logado (magic link) escolhe o pedido, quais itens, motivo,
-- e acompanha o status; admin gerencia em /admin/solicitacoes-troca (mesmo padrão de
-- eh_admin() já usado em pedidos/produtos/envios, ver migration-010-controle-admin.sql).
--
-- `itens` é um snapshot jsonb (produtoNome/produtoSlug/tamanho/cor/quantidade) igual
-- `pedidos.itens` — não referencia item por id porque `ItemPedido` não tem um (nem `pedidos`
-- guarda `produtoId` por item), só o nome/slug/variante escolhidos na hora do pedido.

create table if not exists solicitacoes_troca (
  id uuid primary key default gen_random_uuid(),
  pedido_codigo text not null references pedidos(codigo),
  email_cliente text not null,
  tipo text not null check (tipo in ('troca', 'devolucao')),
  itens jsonb not null,
  motivo text not null,
  observacoes text,
  status text not null default 'pendente' check (
    status in ('pendente', 'em_analise', 'aprovada', 'recusada', 'concluida')
  ),
  resposta_admin text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table solicitacoes_troca enable row level security;

-- Cliente autenticado só pode criar solicitação em nome do próprio e-mail (mesmo `lower(...)`
-- usado na policy de leitura de pedidos, migration-010) — evita um cliente logado abrir
-- solicitação usando o e-mail de outra pessoa.
create policy "Cliente pode criar solicitacao de troca"
  on solicitacoes_troca for insert
  to authenticated
  with check (lower(email_cliente) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Cliente só lê as próprias solicitações; admin lê todas (RLS combina policies com OR).
create policy "Cliente pode ler as proprias solicitacoes de troca"
  on solicitacoes_troca for select
  to authenticated
  using (lower(email_cliente) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Admin pode ler todas as solicitacoes de troca"
  on solicitacoes_troca for select
  to authenticated
  using (eh_admin());

-- Só admin muda status/resposta — cliente não edita a própria solicitação depois de criada.
create policy "Admin pode atualizar solicitacoes de troca"
  on solicitacoes_troca for update
  to authenticated
  using (eh_admin())
  with check (eh_admin());
