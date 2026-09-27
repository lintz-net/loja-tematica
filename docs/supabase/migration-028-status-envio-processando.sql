-- Rode isto no SQL Editor do Supabase.
-- Adiciona 'processando' aos valores aceitos em envios.status_envio.
--
-- Contexto (2026-09-27): a Edge Function melhor-envio-comprar-etiqueta marcava
-- status_envio = 'gerado' direto da resposta HTTP 200 de POST /api/v2/me/shipment/generate —
-- mas esse 200 só confirma que o pedido de geração foi ACEITO pro processamento assíncrono
-- deles, não que a etiqueta já existe de verdade. Em testes reais, a geração falhou depois
-- (do lado do Melhor Envio) sem disparar nenhum evento de erro no webhook — o status ficava
-- preso em 'gerado'/'liberado' parecendo saudável, sem nenhum alerta pro admin. A confirmação
-- de verdade só vem do evento `order.generated` (webhook), que já tinha um mapeamento pronto
-- em SUFIXO_PARA_STATUS_ENVIO mas nunca era a fonte real do 'gerado' na prática.
--
-- 'processando' é o novo estado intermediário: "geração solicitada, aguardando confirmação
-- assíncrona" — só o webhook `order.generated` avança pra 'gerado' de verdade a partir daqui.

alter table envios drop constraint envios_status_envio_check;

alter table envios add constraint envios_status_envio_check check (
  status_envio in (
    'aguardando_compra',
    'pendente_etiqueta',
    'processando',
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
);
