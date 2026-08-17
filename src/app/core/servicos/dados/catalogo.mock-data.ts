import { Categoria } from '../../modelos/categoria.model';
import { Produto, VarianteProduto } from '../../modelos/produto.model';
import { MANIFESTO_OZKLO } from './catalogo-ozklo.manifest';

export const CATEGORIAS: Categoria[] = [
  {
    id: 'cat-01',
    nome: 'Música',
    slug: 'musica',
    corTema: '#ff2d6f',
    descricaoCurta: 'Para quem vive no ritmo dos palcos e alto-falantes.',
    icone: '🎸',
  },
  {
    id: 'cat-02',
    nome: 'Futebol',
    slug: 'futebol',
    corTema: '#1fa34d',
    descricaoCurta: 'Camisas e lembranças para torcedores de coração.',
    icone: '⚽',
  },
  {
    id: 'cat-03',
    nome: 'Geek',
    slug: 'geek',
    corTema: '#7b2ff7',
    descricaoCurta: 'Referências de games, HQs e cultura nerd.',
    icone: '🕹️',
  },
  {
    id: 'cat-04',
    nome: 'Automotivo',
    slug: 'automotivo',
    corTema: '#ff8a00',
    descricaoCurta: 'Para quem sente o motor antes de ver o carro.',
    icone: '🏁',
  },
  {
    id: 'cat-05',
    nome: 'Cinema',
    slug: 'cinema',
    corTema: '#c9a227',
    descricaoCurta: 'Cenas e clássicos que marcaram gerações.',
    icone: '🎬',
  },
  {
    id: 'cat-06',
    nome: 'Humor',
    slug: 'humor',
    corTema: '#ffd400',
    descricaoCurta: 'Piadas, memes e frases pra tirar um sorriso.',
    icone: '😂',
  },
];

function gerarVariantes(
  produtoId: string,
  skuBase: string,
  tamanhos: string[],
  cores: string[],
  precoOverride?: number
): VarianteProduto[] {
  const variantes: VarianteProduto[] = [];
  let contador = 1;
  for (const tamanho of tamanhos) {
    for (const cor of cores) {
      variantes.push({
        id: `${produtoId}-v${contador}`,
        produtoId,
        sku: `${skuBase}-${tamanho}-${cor.substring(0, 3).toUpperCase()}`,
        tamanho,
        cor,
        // Seed determinística: mesmo estoque a cada leitura, evitando divergências entre telas.
        quantidadeEstoque: ((contador * 7 + skuBase.length * 3) % 30) + 1,
        precoOverride,
      });
      contador++;
    }
  }
  return variantes;
}

/** Imagens reais, baixadas do fornecedor e servidas de public/imagens/produtos/<slug>. */
function imagensLocais(slug: string, quantidade: number): string[] {
  return Array.from(
    { length: quantidade },
    (_, indice) => `/imagens/produtos/${slug}/foto_${String(indice + 1).padStart(2, '0')}.webp`
  );
}

/** Placeholder para produtos fictícios: 1ª imagem "produto", 2ª simula um modelo vestindo (para o hover). */
function imagensPlaceholder(seed: string): string[] {
  return [
    `https://picsum.photos/seed/${seed}/600/600`,
    `https://picsum.photos/seed/${seed}-modelo/600/800`,
  ];
}

/** Monta o mapa cor → fotos a partir dos números de foto já conferidos manualmente para o slug. */
function imagensPorCorLocais(slug: string, porCor: Record<string, number[]>): Record<string, string[]> {
  const resultado: Record<string, string[]> = {};
  for (const [cor, indices] of Object.entries(porCor)) {
    resultado[cor] = indices.map(
      (indice) => `/imagens/produtos/${slug}/foto_${String(indice).padStart(2, '0')}.webp`
    );
  }
  return resultado;
}

const TAMANHOS_CAMISETA = ['P', 'M', 'G', 'GG'];
const TAMANHOS_UNICO = ['Único'];

/** Cores padrão de mock por tipo de peça — a Ozklo não nos passou o mapa real de cor por SKU
 * para este lote, então usamos uma paleta plausível até os dados reais chegarem. */
const CORES_PADRAO_POR_TIPO: Record<string, string[]> = {
  camiseta: ['Preto', 'Branco', 'Cinza'],
  bermuda: ['Preto', 'Bege', 'Azul Marinho'],
  polo: ['Preto', 'Branco', 'Azul Marinho'],
};

/**
 * Gera os produtos do lote grande importado da Ozklo (public/imagens/produtos/<slug>),
 * a partir do manifesto gerado automaticamente pelas fotos baixadas. Nome, categoria e tipo
 * de peça são inferidos do nome do arquivo/pasta original; cores são um mock genérico —
 * ajuste em MANIFESTO_OZKLO ou aqui quando tiver os dados reais de SKU/cor do fornecedor.
 */
function gerarProdutosOzkloEmMassa(): Produto[] {
  return MANIFESTO_OZKLO.map((item, indice) => {
    const id = `prod-oz-${indice + 1}`;
    const skuBase = `OZ${String(indice + 1).padStart(3, '0')}`;
    const cores = CORES_PADRAO_POR_TIPO[item.tipoPeca] ?? CORES_PADRAO_POR_TIPO['camiseta'];
    return {
      id,
      nome: item.nome,
      slug: item.slug,
      descricao: `${item.nome}. Confira todas as fotos para ver detalhes de estampa e caimento.`,
      precoBase: item.precoBase,
      categorias: [item.categoria],
      imagens: imagensLocais(item.slug, item.quantidadeImagens),
      variantes: gerarVariantes(id, skuBase, TAMANHOS_CAMISETA, cores),
    };
  });
}

export const PRODUTOS: Produto[] = [
  // Produtos reais do catálogo Ozklo (linha masculino/geek), levantados em 2026-08-09
  // para o mock de revenda. Preço e variantes conferem com o site; as fotos foram
  // baixadas do fornecedor e ficam em public/imagens/produtos/<slug>.
  {
    id: 'prod-16',
    nome: 'Camiseta Masculina Estampada Coyote',
    slug: 'camiseta-coyote',
    descricao: 'Camiseta estampada com o personagem Coyote, para os fãs de desenhos clássicos.',
    precoBase: 45.0,
    categorias: ['geek'],
    imagens: imagensLocais('camiseta-coyote', 11),
    variantes: gerarVariantes(
      'prod-16',
      'CCY',
      TAMANHOS_CAMISETA.filter((t) => t !== 'P'),
      ['Bege', 'Azul Marinho', 'Azul Claro', 'Cinza', 'Vermelho', 'Verde Claro', 'Branco', 'Preto']
    ),
  },
  {
    id: 'prod-17',
    nome: 'Camiseta Patolino',
    slug: 'camiseta-patolino',
    descricao: 'Camiseta estampada com o personagem Patolino, clássico dos Looney Tunes.',
    precoBase: 45.0,
    categorias: ['geek'],
    imagens: imagensLocais('camiseta-patolino', 8),
    variantes: gerarVariantes('prod-17', 'CPT', TAMANHOS_CAMISETA, [
      'Branco',
      'Preto',
      'Azul Marinho',
      'Marrom',
      'Verde Claro',
      'Vermelho',
      'Cinza Chumbo',
    ]),
  },
  {
    id: 'prod-18',
    nome: 'Camiseta Papaléguas',
    slug: 'camiseta-papaleguas',
    descricao: 'Camiseta estampada com o personagem Papaléguas, ícone dos Looney Tunes.',
    precoBase: 45.0,
    categorias: ['geek'],
    imagens: imagensLocais('camiseta-papaleguas', 7),
    variantes: gerarVariantes(
      'prod-18',
      'CPL',
      TAMANHOS_CAMISETA.filter((t) => t !== 'P'),
      ['Preto', 'Laranja', 'Marrom', 'Branco', 'Verde Claro', 'Bege']
    ),
  },
  {
    id: 'prod-19',
    nome: 'Camiseta Jaspion',
    slug: 'camiseta-jaspion',
    descricao: 'Camiseta estampada com o herói tokusatsu Jaspion, clássico dos anos 80.',
    precoBase: 45.0,
    categorias: ['geek'],
    imagens: imagensLocais('camiseta-jaspion', 6),
    variantes: gerarVariantes('prod-19', 'CJP', TAMANHOS_CAMISETA, [
      'Preto',
      'Branco',
      'Cinza',
      'Bege',
      'Verde Claro',
      'Marrom',
    ]),
  },
  {
    id: 'prod-20',
    nome: 'Camiseta Donkey Kong',
    slug: 'camiseta-donkey-kong',
    descricao: 'Camiseta estampada com o Donkey Kong, ícone dos games retrô da Nintendo.',
    precoBase: 45.0,
    categorias: ['geek'],
    imagens: imagensLocais('camiseta-donkey-kong', 13),
    // Mapeado manualmente conferindo as fotos: cada cor tem seu próprio registro no fornecedor.
    // As demais 121 peças do lote Ozklo não têm esse mapeamento ainda (ver nota em imagensPorCor no model).
    imagensPorCor: imagensPorCorLocais('camiseta-donkey-kong', {
      Vermelho: [1, 2],
      'Azul Marinho': [11, 3],
      Mostarda: [5],
      Preto: [6],
      Vinho: [7],
      'Azul Jeans': [8],
      'Verde Claro': [9],
      'Verde Musgo': [10],
      Bege: [12],
      // foto_13 (cinza) e foto_04 (tabela de medidas) não correspondem a nenhuma cor vendável
      // e ficam de fora do mapa — ainda aparecem nas miniaturas via `imagens`.
    }),
    variantes: gerarVariantes('prod-20', 'CDK', TAMANHOS_CAMISETA, [
      'Mostarda',
      'Preto',
      'Verde Musgo',
      'Vinho',
      'Azul Jeans',
      'Verde Claro',
      'Azul Marinho',
      'Bege',
      'Vermelho',
    ]),
  },
  {
    id: 'prod-21',
    nome: 'Camiseta Tartaruga Tuchê',
    slug: 'camiseta-tuche',
    descricao: 'Camiseta estampada com a Tartaruga Tuchê, personagem clássico do humor brasileiro.',
    precoBase: 45.0,
    categorias: ['geek'],
    imagens: imagensLocais('camiseta-tuche', 10),
    variantes: gerarVariantes('prod-21', 'CTU', TAMANHOS_UNICO, ['Colorido']),
  },
  ...gerarProdutosOzkloEmMassa(),
];
