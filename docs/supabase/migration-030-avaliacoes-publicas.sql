-- Rode isto no SQL Editor do Supabase.
--
-- Contexto (2026-10-03): avaliações até aqui só existiam via cadastro manual do admin
-- (`/admin/avaliacoes`), sem formulário público — decisão deliberada do usuário foi abrir
-- isso pro cliente, mas com moderação (fica "pendente" até o admin aprovar, não aparece
-- pro público sozinho — evita spam/review falsa indo ao ar sem ninguém ver antes).
--
-- `default 'aprovada'` (não 'pendente') é proposital: isso faz todas as avaliações já
-- cadastradas pelo admin até hoje virarem 'aprovada' automaticamente no backfill da coluna
-- nova, sem sumir da página do produto. Submissões novas do público sempre mandam
-- status='pendente' explicitamente (ver avaliacao-api.service.ts), nunca usam esse default.

alter table avaliacoes
  add column if not exists status text not null default 'aprovada'
    check (status in ('pendente', 'aprovada', 'rejeitada'));

-- Só avaliação aprovada é pública; admin sempre vê tudo (pra poder moderar as pendentes).
drop policy if exists "avaliacoes_select_publico" on avaliacoes;
create policy "avaliacoes_select_publico" on avaliacoes
  for select
  using (status = 'aprovada' or eh_admin());

-- Qualquer um pode criar uma avaliação nova (sem precisar de login) — mas só como 'pendente'.
-- O `with check` barra na escrita: mesmo que o código do frontend tivesse um bug mandando
-- 'aprovada' direto, o Postgres rejeitaria o insert.
create policy "avaliacoes_publico_insert" on avaliacoes
  for insert
  to anon, authenticated
  with check (status = 'pendente');
