-- Rode isto no SQL Editor do Supabase.
-- A policy de insert só liberava a role 'anon'. Se o navegador estiver com uma sessão de
-- admin ativa (logado em /admin/login), o Supabase passa a mandar as requisições como
-- 'authenticated' em vez de 'anon' — e o checkout falhava com "new row violates row-level
-- security policy" porque não havia policy de insert pra 'authenticated'.
-- Corrige liberando insert pra qualquer visitante, logado ou não.

drop policy if exists "Qualquer um pode inserir pedidos" on pedidos;

create policy "Qualquer um pode inserir pedidos"
  on pedidos for insert
  to anon, authenticated
  with check (true);
