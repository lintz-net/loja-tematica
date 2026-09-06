import { Produto, VarianteProduto } from '../modelos/produto.model';

/** Imagem representativa de um item (produto + variante escolhida) — usa a primeira foto
 * específica da cor selecionada quando o produto tem esse de-para (`imagensPorCor`),
 * senão cai na primeira imagem geral do produto. Usado em qualquer lugar que mostre a
 * "foto do item" (carrinho, gaveta, checkout, pedido) pra sempre bater com a cor
 * escolhida, em vez de sempre mostrar a primeira foto do produto. */
export function imagemDaVariante(produto: Produto, variante: VarianteProduto): string {
  const fotosDaCor = produto.imagensPorCor?.[variante.cor];
  return fotosDaCor?.[0] ?? produto.imagens[0] ?? '';
}
