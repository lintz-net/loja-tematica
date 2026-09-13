/** Slug da categoria — vem do banco (`categorias.slug`), não é uma lista fixa: cada loja
 * define as categorias que quiser em `/admin` (ou direto na tabela). Mantido como alias em
 * vez de `string` cru só pra deixar a intenção clara nos outros modelos/services que o usam. */
export type SlugCategoria = string;

export interface Categoria {
  id: string;
  nome: string;
  slug: SlugCategoria;
  corTema: string;
  descricaoCurta: string;
  icone: string;
}
