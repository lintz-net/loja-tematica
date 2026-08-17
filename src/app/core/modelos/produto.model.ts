import { SlugCategoria } from './categoria.model';

export interface VarianteProduto {
  id: string;
  produtoId: string;
  sku: string;
  tamanho: string;
  cor: string;
  quantidadeEstoque: number;
  precoOverride?: number;
}

export interface FaixaMedida {
  tamanho: string;
  larguraCm: number;
  comprimentoCm: number;
}

export interface Produto {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  precoBase: number;
  categorias: SlugCategoria[];
  /** Imagens do produto, em ordem de exibição. A primeira é a imagem principal da listagem;
   * a segunda (quando existir) é usada no hover da listagem e deve preferencialmente mostrar
   * um modelo vestindo a peça. */
  imagens: string[];
  /** Fotos específicas de cada cor (quando o fornecedor fotografou cada variante). Ao selecionar
   * uma cor com entrada aqui, a galeria do detalhe passa a exibir só essas fotos; sem entrada
   * para a cor, ou sem cor selecionada, a galeria volta a mostrar `imagens` inteira. */
  imagensPorCor?: Record<string, string[]>;
  /** Tabela de medidas para o modal "Guia de medidas". Quando ausente, usa-se uma tabela genérica. */
  guiaMedidas?: FaixaMedida[];
  variantes: VarianteProduto[];
}
