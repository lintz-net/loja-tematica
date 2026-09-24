-- Rode isto no SQL Editor do Supabase.
-- Nova categoria "Personagens" — produtos importados da OZKLO com estampas de
-- personagens (filme/jogo/HQ/meme) que não se encaixam nas categorias temáticas já
-- existentes (a OZKLO categoriza por corte de peça, não por tema; "Personagens" lá é uma
-- categoria própria que decidimos manter, ao contrário de "Unisex"/"Polos"/"Básicas" etc.,
-- que são tipo de peça/corte, não tema, e por isso não viram categoria aqui).

insert into categorias (id, nome, slug, cor_tema, descricao_curta, icone) values
  ('cat-07', 'Personagens', 'personagens', '#4361ee', 'Ícones e personagens que marcaram época.', '🎭')
on conflict (id) do nothing;
