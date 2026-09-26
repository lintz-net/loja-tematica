-- Rode isto no SQL Editor do Supabase.
-- Ajusta peso/dimensões das 5 bermudas do catálogo, que tinham recebido por engano os
-- valores de camiseta (migration-025-peso-dimensoes-catalogo.sql) — bermuda é peça diferente
-- (tecido mais grosso, mais volume), não deveria ter caído na mesma regra por tamanho.
-- Valores por produto fornecidos pelo usuário (2026-09-26): cada modelo tem peso/dimensão
-- próprios (não é uma regra por tamanho como em camiseta), então aqui é um UPDATE direto por
-- id, sobrescrevendo o que a migration anterior tinha colocado.

update produtos set peso_kg = 0.25, altura_cm = 3, largura_cm = 25, comprimento_cm = 30
where id = 'ozklo-bermuda-tactel';

update produtos set peso_kg = 0.30, altura_cm = 4, largura_cm = 25, comprimento_cm = 30
where id = 'ozklo-bermuda-elanca';

update produtos set peso_kg = 0.30, altura_cm = 4, largura_cm = 25, comprimento_cm = 30
where id = 'ozklo-bermuda-ribana';

update produtos set peso_kg = 0.30, altura_cm = 4, largura_cm = 25, comprimento_cm = 30
where id = 'ozklo-bermuda-linho';

update produtos set peso_kg = 0.45, altura_cm = 6, largura_cm = 27, comprimento_cm = 32
where id = 'ozklo-bermuda-em-sarja-resistente-com-8-bolsos-laterais-e-traseiros';
