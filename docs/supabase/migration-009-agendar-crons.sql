-- Rode isto no SQL Editor do Supabase (ou via `supabase db query --linked -f`).
-- Agenda via pg_cron os dois jobs periódicos da integração Melhor Envio que só existiam como
-- Edge Function, sem nada disparando eles sozinhos:
--   1) melhor-envio-refresh-token — renova o access_token antes de expirar (30 dias de
--      validade, 45 dias o refresh_token). Diário é sobra de margem.
--   2) melhor-envio-rastrear-pendentes — fallback de polling do rastreio. A rota do Melhor
--      Envio tem cache de 1h do lado deles, então de hora em hora é o máximo que faz sentido.
--
-- A chave usada nos headers é a publishable/anon (pública, já exposta no frontend em
-- src/environments/environment.ts) — só serve pra passar pelo gateway de autenticação do
-- Supabase; a autorização de verdade com o Melhor Envio usa o token guardado em
-- `tokens_melhor_envio`, lido pela própria Edge Function via service_role.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'melhor-envio-refresh-token',
  '0 3 * * *', -- todo dia às 3h (UTC)
  $$
  select net.http_post(
    url := 'https://tmrtyotlvrznavjorkay.supabase.co/functions/v1/melhor-envio-refresh-token',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_C-19JMHS11IjYHJ4ngIFQw_wfojX8DA',
      'Authorization', 'Bearer sb_publishable_C-19JMHS11IjYHJ4ngIFQw_wfojX8DA'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'melhor-envio-rastrear-pendentes',
  '0 * * * *', -- de hora em hora
  $$
  select net.http_post(
    url := 'https://tmrtyotlvrznavjorkay.supabase.co/functions/v1/melhor-envio-rastrear-pendentes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_C-19JMHS11IjYHJ4ngIFQw_wfojX8DA',
      'Authorization', 'Bearer sb_publishable_C-19JMHS11IjYHJ4ngIFQw_wfojX8DA'
    ),
    body := '{}'::jsonb
  );
  $$
);
