-- Rode isto no SQL Editor do Supabase.
-- Vídeos do produto exibidos na galeria do detalhe, depois de todas as fotos. Nullable: a
-- maioria dos produtos não vai ter vídeo, e a galeria já trata ausência como array vazio.

alter table produtos
  add column if not exists videos jsonb;
