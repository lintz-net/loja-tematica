import { imagemDaVariante } from './imagem-produto.util';
import { Produto, VarianteProduto } from '../modelos/produto.model';

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'p1',
    nome: 'Camiseta Batman',
    slug: 'camiseta-batman',
    descricao: '',
    precoBase: 50,
    categorias: [],
    imagens: ['/geral-1.webp', '/geral-2.webp'],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

function criarVariante(sobrescritas: Partial<VarianteProduto> = {}): VarianteProduto {
  return {
    id: 'v1',
    produtoId: 'p1',
    sku: 'SKU-1',
    tamanho: 'M',
    cor: 'Preto',
    quantidadeEstoque: 5,
    ...sobrescritas,
  };
}

describe('imagemDaVariante', () => {
  it('usa a primeira foto específica da cor quando existe imagensPorCor pra essa cor', () => {
    const produto = criarProduto({ imagensPorCor: { Preto: ['/preto-1.webp', '/preto-2.webp'] } });

    expect(imagemDaVariante(produto, criarVariante({ cor: 'Preto' }))).toBe('/preto-1.webp');
  });

  it('cai na primeira imagem geral quando não há fotos específicas pra cor da variante', () => {
    const produto = criarProduto({ imagensPorCor: { Branco: ['/branco-1.webp'] } });

    expect(imagemDaVariante(produto, criarVariante({ cor: 'Preto' }))).toBe('/geral-1.webp');
  });

  it('cai na primeira imagem geral quando o produto não tem imagensPorCor', () => {
    const produto = criarProduto();

    expect(imagemDaVariante(produto, criarVariante())).toBe('/geral-1.webp');
  });

  it('devolve string vazia quando não há nenhuma imagem', () => {
    const produto = criarProduto({ imagens: [] });

    expect(imagemDaVariante(produto, criarVariante())).toBe('');
  });
});
