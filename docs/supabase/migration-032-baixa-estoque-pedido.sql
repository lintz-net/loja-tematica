-- Rode isto no SQL Editor do Supabase.
--
-- Contexto (2026-10-04): até aqui o estoque (`produtos.variantes[].quantidadeEstoque`) só
-- mudava por edição manual do admin em `/admin/produtos` — nunca era baixado automaticamente
-- quando um pedido era pago. Na prática isso significa que dois clientes podiam "comprar" a
-- última unidade de um tamanho/cor ao mesmo tempo sem o site perceber. Comparado com o
-- funcionamento documentado da Vendizap (referência usada pra essa decisão): eles baixam
-- estoque na finalização do pedido, mesmo sem pagamento confirmado — decidimos baixar só na
-- aprovação do pagamento pelo Mercado Pago (mais simples, sem precisar de reserva temporária,
-- e hoje só existe pagamento via Mercado Pago no checkout, sem Pix manual/dinheiro).
--
-- `estoque_baixado` existe só pra idempotência: o webhook do Mercado Pago pode notificar o
-- mesmo pagamento mais de uma vez, e o pagamento por cartão já confirma status na hora (via
-- resposta síncrona) — sem essa flag, o mesmo pedido poderia baixar estoque duas vezes.

alter table pedidos
  add column if not exists estoque_baixado boolean not null default false;
