-- Rode isto no SQL Editor do Supabase.
-- ⚠️ Destrutivo e definitivo: apaga todos os produtos E pedidos atuais (loja pivotando pra
-- ser revendedora autorizada da OZKLO; catálogo e pedidos antigos são dados de teste, sem
-- necessidade de manter histórico).
--
-- Ordem importa: `envios.codigo_pedido` referencia `pedidos(codigo)` sem cascade — apagar
-- pedidos antes de envios quebraria com erro de FK. `eventos_webhook_mercado_pago` e
-- `eventos_webhook_melhor_envio` só guardam o payload cru do webhook (sem FK pra pedidos),
-- não precisam ser tocados, mas ficam sem sentido sem os pedidos correspondentes — apagados
-- aqui também só por limpeza.
--
-- Efeitos colaterais aceitos (avisados, não corrigidos aqui):
--   - avaliacoes.produto_id vira null nas avaliações desses produtos (on delete set null) —
--     a avaliação em si continua existindo, só sem vínculo com um produto específico.
--   - avisos_estoque dos produtos antigos são apagados junto (on delete cascade).
--   - Categorias (Música, Futebol, Geek, Automotivo, Cinema, Humor, Personagens) NÃO são
--     apagadas aqui, de propósito — ficam vazias até a importação da OZKLO preencher as que
--     mapeiam (Geek/Automotivo/Música/Personagens via MAPA_CATEGORIAS em importar.py).
--   - Arquivos de imagem antigos no bucket "produtos" do Storage não são apagados por este
--     SQL (Storage não é gerenciável via SQL puro) — ficam órfãos lá, sem custo funcional,
--     só espaço; remover via Storage UI do Supabase se quiser limpar de verdade.
--
-- Limpa staging_produtos_ozklo também: sem isso, linhas que já estivessem vinculadas
-- (produto_id) apontariam pra produtos que não existem mais depois deste delete, e a próxima
-- rodada do importar.py trataria isso como erro em vez de criar os produtos do zero.

delete from envios;
delete from eventos_webhook_melhor_envio;
delete from eventos_webhook_mercado_pago;
delete from pedidos;
delete from produtos;
delete from staging_produtos_ozklo;
