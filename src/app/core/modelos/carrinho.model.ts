import { Produto, VarianteProduto } from './produto.model';

export interface ItemCarrinho {
  produto: Produto;
  variante: VarianteProduto;
  quantidade: number;
}
