export type SlugCategoria =
  | 'musica'
  | 'futebol'
  | 'geek'
  | 'automotivo'
  | 'cinema'
  | 'humor';

export interface Categoria {
  id: string;
  nome: string;
  slug: SlugCategoria;
  corTema: string;
  descricaoCurta: string;
  icone: string;
}
