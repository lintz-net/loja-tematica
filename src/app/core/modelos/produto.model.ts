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
  /** Opcional — nem toda tabela de medidas informa cintura (a padrão da loja, masculina/
   * unissex e feminina, informa; uma tabela customizada por produto pode não ter). */
  cinturaCm?: number;
}

export type GeneroProduto = 'masculino' | 'feminino' | 'unissex';

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
  /** Vídeos do produto exibidos na galeria do detalhe, depois de todas as fotos — não entram
   * na listagem/hover/SEO, só na galeria em si. */
  videos?: string[];
  /** Tabela de medidas para o modal "Guia de medidas". Quando ausente, usa-se a tabela
   * padrão masculina/unissex ou feminina (baby look) da loja, de acordo com `genero`. */
  guiaMedidas?: FaixaMedida[];
  /** Determina qual tabela padrão de medidas mostrar quando `guiaMedidas` não é informado.
   * `unissex` cai na mesma tabela que `masculino` (corte tradicional, sem tabela própria). */
  genero?: GeneroProduto;
  /** Peso/dimensões de uma unidade — usados na cotação de frete (Melhor Envio). Quando
   * ausentes, a cotação usa um valor padrão genérico (menos preciso). */
  pesoKg?: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
  variantes: VarianteProduto[];
  /** Curadoria manual de produtos em destaque na home — não é calculado automaticamente
   * (ex.: mais vendidos), o admin decide quais produtos entram. */
  destaque: boolean;
  /** Ordem manual dos produtos em destaque (menor primeiro). Ausente cai no fallback de
   * ordenação por data de criação, mais recente primeiro. */
  ordemDestaque?: number | null;
  /** Quando presente e menor que `precoBase`, o produto entra no carrossel de ofertas da
   * home e o card exibe o preço base riscado. */
  precoPromocional?: number | null;
}
