-- Rode isto no SQL Editor do Supabase.
--
-- Corrige SKUs duplicados no catálogo (34 SKUs duplicados, 86 variações afetadas,
-- encontrados em 2026-10-08 ao preparar a integração com o Mercado Livre — a tabela
-- `inventory` dessa integração usa SKU como chave única por variação, e boa parte do
-- catálogo importado da OZKLO usava um esquema de SKU (prefixo + cor + tamanho) que
-- colidia entre produtos diferentes, ou dentro do mesmo produto com cores/tecidos
-- parecidos (ex.: SMURFPM repetido em 14 variações diferentes, entre dois produtos).
--
-- Mantém o SKU original na primeira variação de cada grupo duplicado (ordenado por id
-- de variação) e acrescenta um sufixo numérico nas demais (ex.: SMURFPM -> SMURFPM-02,
-- SMURFPM-03...), só nas variações que precisavam mudar — não mexe em nenhum SKU que
-- já era único.

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-nova-camiseta-capitao-caverna-colecao-retro-cartoon-v9' then jsonb_set(elem, '{sku}', '"NOVOCAPITÃOVG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-nova-camiseta-capitao-caverna-colecao-retro-cartoon';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v13' then jsonb_set(elem, '{sku}', '"SMURFPM-02"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v17' then jsonb_set(elem, '{sku}', '"SMURFPM-03"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v18' then jsonb_set(elem, '{sku}', '"SMURFPM-04"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v19' then jsonb_set(elem, '{sku}', '"SMURFPM-05"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v2' then jsonb_set(elem, '{sku}', '"SMURFPM-06"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v20' then jsonb_set(elem, '{sku}', '"SMURFPM-07"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v21' then jsonb_set(elem, '{sku}', '"SMURFPM-08"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v22' then jsonb_set(elem, '{sku}', '"SMURFPM-09"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v23' then jsonb_set(elem, '{sku}', '"SMURFPM-10"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v24' then jsonb_set(elem, '{sku}', '"SMURFPM-11"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v5' then jsonb_set(elem, '{sku}', '"SMURFPM-12"')
      when elem->>'id' = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester-v9' then jsonb_set(elem, '{sku}', '"SMURFPM-13"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-gato-felix-retro-em-algodao-e-poliester';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v1' then jsonb_set(elem, '{sku}', '"SMURFPM-14"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v2' then jsonb_set(elem, '{sku}', '"SMURFPG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v3' then jsonb_set(elem, '{sku}', '"SMURFPGG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v4' then jsonb_set(elem, '{sku}', '"SMURFBM-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v5' then jsonb_set(elem, '{sku}', '"SMURFBG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v6' then jsonb_set(elem, '{sku}', '"SMURFBGG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v7' then jsonb_set(elem, '{sku}', '"SMURFVM-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v8' then jsonb_set(elem, '{sku}', '"SMURFVG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v9' then jsonb_set(elem, '{sku}', '"SMURFVGG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v13' then jsonb_set(elem, '{sku}', '"SMURFAMM-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v14' then jsonb_set(elem, '{sku}', '"SMURFAMG-02"')
      when elem->>'id' = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester-v15' then jsonb_set(elem, '{sku}', '"SMURFAMGG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-papai-smurfs-retro-em-algodao-e-poliester';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v21' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-02"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v22' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-03"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v23' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-04"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v24' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-05"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v25' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-06"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v26' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-07"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v27' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-08"')
      when elem->>'id' = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada-v28' then jsonb_set(elem, '{sku}', '"SNOOPFEMPM-09"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-snoopy-baby-look-tecido-em-algodao-estampa-emborrachada';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-cubo-magico-v8' then jsonb_set(elem, '{sku}', '"CUBOAMG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-cubo-magico';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-pica-pau-v31' then jsonb_set(elem, '{sku}', '"PICCLABP-02"')
      when elem->>'id' = 'ozklo-camiseta-pica-pau-v32' then jsonb_set(elem, '{sku}', '"PICCLABP-03"')
      when elem->>'id' = 'ozklo-camiseta-pica-pau-v33' then jsonb_set(elem, '{sku}', '"PICCLABP-04"')
      when elem->>'id' = 'ozklo-camiseta-pica-pau-v34' then jsonb_set(elem, '{sku}', '"PICCLABP-05"')
      when elem->>'id' = 'ozklo-camiseta-pica-pau-v35' then jsonb_set(elem, '{sku}', '"PICCLABP-06"')
      when elem->>'id' = 'ozklo-camiseta-pica-pau-v36' then jsonb_set(elem, '{sku}', '"PICCLABP-07"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-pica-pau';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-stich-v8' then jsonb_set(elem, '{sku}', '"STICHAMG-02"')
      when elem->>'id' = 'ozklo-camiseta-stich-v9' then jsonb_set(elem, '{sku}', '"STICHAMGG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-stich';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-bobby-s-world-retro-unissex-estilo-vintage-geek-anos-90-v13' then jsonb_set(elem, '{sku}', '"FMDBOBCRM-02"')
      when elem->>'id' = 'ozklo-camiseta-bobby-s-world-retro-unissex-estilo-vintage-geek-anos-90-v17' then jsonb_set(elem, '{sku}', '"FMDBOBCRM-03"')
      when elem->>'id' = 'ozklo-camiseta-bobby-s-world-retro-unissex-estilo-vintage-geek-anos-90-v2' then jsonb_set(elem, '{sku}', '"FMDBOBCRM-04"')
      when elem->>'id' = 'ozklo-camiseta-bobby-s-world-retro-unissex-estilo-vintage-geek-anos-90-v5' then jsonb_set(elem, '{sku}', '"FMDBOBCRM-05"')
      when elem->>'id' = 'ozklo-camiseta-bobby-s-world-retro-unissex-estilo-vintage-geek-anos-90-v9' then jsonb_set(elem, '{sku}', '"FMDBOBCRM-06"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-bobby-s-world-retro-unissex-estilo-vintage-geek-anos-90';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v10' then jsonb_set(elem, '{sku}', '"NGKVMM-02"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v11' then jsonb_set(elem, '{sku}', '"NGKVMM-03"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v12' then jsonb_set(elem, '{sku}', '"NGKVMM-04"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v13' then jsonb_set(elem, '{sku}', '"NGKVMM-05"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v14' then jsonb_set(elem, '{sku}', '"NGKVMM-06"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v15' then jsonb_set(elem, '{sku}', '"NGKVMM-07"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v16' then jsonb_set(elem, '{sku}', '"NGKVMM-08"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v17' then jsonb_set(elem, '{sku}', '"NGKVMM-09"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v18' then jsonb_set(elem, '{sku}', '"NGKVMM-10"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v2' then jsonb_set(elem, '{sku}', '"NGKVMM-11"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v3' then jsonb_set(elem, '{sku}', '"NGKVMM-12"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v4' then jsonb_set(elem, '{sku}', '"NGKVMM-13"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v5' then jsonb_set(elem, '{sku}', '"NGKVMM-14"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v6' then jsonb_set(elem, '{sku}', '"NGKVMM-15"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v7' then jsonb_set(elem, '{sku}', '"NGKVMM-16"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v8' then jsonb_set(elem, '{sku}', '"NGKVMM-17"')
      when elem->>'id' = 'ozklo-camiseta-naruto-estampa-emborrachada-v9' then jsonb_set(elem, '{sku}', '"NGKVMM-18"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-naruto-estampa-emborrachada';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-novo-goku-v1' then jsonb_set(elem, '{sku}', '"NGKVMM-19"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-novo-goku';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-opala-conforto-premium-nao-desbota-v17' then jsonb_set(elem, '{sku}', '"OPALABM-02"')
      when elem->>'id' = 'ozklo-camiseta-opala-conforto-premium-nao-desbota-v2' then jsonb_set(elem, '{sku}', '"OPALABG-02"')
      when elem->>'id' = 'ozklo-camiseta-opala-conforto-premium-nao-desbota-v3' then jsonb_set(elem, '{sku}', '"OPALABGG-02"')
      when elem->>'id' = 'ozklo-camiseta-opala-conforto-premium-nao-desbota-v5' then jsonb_set(elem, '{sku}', '"OPALABP-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-opala-conforto-premium-nao-desbota';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-maquina-de-misterio-v17' then jsonb_set(elem, '{sku}', '"MAQAMP-02"')
      when elem->>'id' = 'ozklo-camiseta-maquina-de-misterio-v2' then jsonb_set(elem, '{sku}', '"MAQAMM-02"')
      when elem->>'id' = 'ozklo-camiseta-maquina-de-misterio-v3' then jsonb_set(elem, '{sku}', '"MAQAMG-02"')
      when elem->>'id' = 'ozklo-camiseta-maquina-de-misterio-v4' then jsonb_set(elem, '{sku}', '"MAQAMGG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-maquina-de-misterio';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-dryfit-com-poliamida-e-estampa-emborrachada-v17' then jsonb_set(elem, '{sku}', '"DRYFITACP-02"')
      when elem->>'id' = 'ozklo-camiseta-dryfit-com-poliamida-e-estampa-emborrachada-v2' then jsonb_set(elem, '{sku}', '"DRYFITACM-02"')
      when elem->>'id' = 'ozklo-camiseta-dryfit-com-poliamida-e-estampa-emborrachada-v3' then jsonb_set(elem, '{sku}', '"DRYFITACG-02"')
      when elem->>'id' = 'ozklo-camiseta-dryfit-com-poliamida-e-estampa-emborrachada-v4' then jsonb_set(elem, '{sku}', '"DRYFITACGG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-dryfit-com-poliamida-e-estampa-emborrachada';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-popeye-v21' then jsonb_set(elem, '{sku}', '"PPPM-02"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v22' then jsonb_set(elem, '{sku}', '"PPPM-03"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v23' then jsonb_set(elem, '{sku}', '"PPPM-04"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v24' then jsonb_set(elem, '{sku}', '"PPPM-05"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v25' then jsonb_set(elem, '{sku}', '"PPPM-06"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v26' then jsonb_set(elem, '{sku}', '"PPPM-07"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v27' then jsonb_set(elem, '{sku}', '"PPPM-08"')
      when elem->>'id' = 'ozklo-camiseta-popeye-v28' then jsonb_set(elem, '{sku}', '"PPPM-09"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-popeye';

update produtos
set variantes = (
  select jsonb_agg(
    case
      when elem->>'id' = 'ozklo-camiseta-gamer-v24' then jsonb_set(elem, '{sku}', '"GAMERBGG-02"')
      else elem
    end
  )
  from jsonb_array_elements(variantes) as elem
)
where id = 'ozklo-camiseta-gamer';
