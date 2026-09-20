-- Rode isto no SQL Editor do Supabase.
-- Mensagens rotativas da barra de anúncio acima do cabeçalho (frete grátis, parcelamento,
-- prazo de entrega etc.) — array de strings simples, editável em /admin/config. Sem policy
-- nova: a tabela configuracao_loja já tem RLS da migration-015 (select público, update só
-- admin via eh_admin()).

alter table configuracao_loja
  add column if not exists mensagens_barra_anuncio jsonb not null default '[]'::jsonb;
