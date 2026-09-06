/**
 * Gera um arquivo SQL com os dados atuais do mock (categorias, produtos, banners) pra rodar
 * uma vez no SQL Editor do Supabase, migrando o catálogo do mock pro banco.
 *
 * Rodar com: npx tsx scripts/gerar-seed-catalogo.ts
 * Gera: docs/supabase/seed-catalogo-gerado.sql
 */
import { writeFileSync } from 'node:fs';
import { CATEGORIAS, PRODUTOS } from '../src/app/core/servicos/dados/catalogo.mock-data';
import { BANNERS } from '../src/app/core/servicos/dados/banner.mock-data';

function sqlString(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

function sqlJson(valor: unknown): string {
  return `'${JSON.stringify(valor).replace(/'/g, "''")}'::jsonb`;
}

function sqlNullableString(valor: string | undefined | null): string {
  return valor === undefined || valor === null ? 'null' : sqlString(valor);
}

const linhas: string[] = [];

linhas.push('-- Gerado automaticamente por scripts/gerar-seed-catalogo.ts — não editar à mão.');
linhas.push('-- Rode isto no SQL Editor do Supabase depois de rodar migration-004-catalogo.sql.\n');

linhas.push('insert into categorias (id, nome, slug, cor_tema, descricao_curta, icone) values');
linhas.push(
  CATEGORIAS.map(
    (c) =>
      `  (${sqlString(c.id)}, ${sqlString(c.nome)}, ${sqlString(c.slug)}, ${sqlString(c.corTema)}, ${sqlString(c.descricaoCurta)}, ${sqlString(c.icone)})`
  ).join(',\n') + '\non conflict (id) do nothing;\n'
);

linhas.push(
  'insert into produtos (id, nome, slug, descricao, preco_base, categorias, imagens, imagens_por_cor, guia_medidas, variantes) values'
);
linhas.push(
  PRODUTOS.map(
    (p) =>
      `  (${sqlString(p.id)}, ${sqlString(p.nome)}, ${sqlString(p.slug)}, ${sqlString(p.descricao)}, ${p.precoBase}, ${sqlJson(p.categorias)}, ${sqlJson(p.imagens)}, ${p.imagensPorCor ? sqlJson(p.imagensPorCor) : 'null'}, ${p.guiaMedidas ? sqlJson(p.guiaMedidas) : 'null'}, ${sqlJson(p.variantes)})`
  ).join(',\n') + '\non conflict (id) do nothing;\n'
);

linhas.push('insert into banners (id, imagem_url, alt, link, ordem) values');
linhas.push(
  BANNERS.map(
    (b, indice) =>
      `  (${sqlString(b.id)}, ${sqlString(b.imagemUrl)}, ${sqlString(b.alt)}, ${sqlNullableString(b.link)}, ${indice})`
  ).join(',\n') + '\non conflict (id) do nothing;\n'
);

const caminhoSaida = 'docs/supabase/seed-catalogo-gerado.sql';
writeFileSync(caminhoSaida, linhas.join('\n'), 'utf-8');
console.log(`Gerado: ${caminhoSaida}`);
console.log(`Categorias: ${CATEGORIAS.length} | Produtos: ${PRODUTOS.length} | Banners: ${BANNERS.length}`);
