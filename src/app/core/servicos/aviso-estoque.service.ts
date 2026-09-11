import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { VarianteProduto, Produto } from '../modelos/produto.model';
import { SupabaseRestService } from './supabase-rest.service';

/** "Avise-me quando chegar" — cadastro público (sem login) pra variantes sem estoque. Insert
 * puro via REST (mesmo padrão de PedidoService): a policy de insert libera `anon`, sem
 * select/update, então não precisa do cliente completo do Supabase. */
@Injectable({ providedIn: 'root' })
export class AvisoEstoqueService {
  private readonly rest = inject(SupabaseRestService);

  cadastrar(produto: Produto, variante: VarianteProduto, email: string): Observable<void> {
    return this.rest.insert('avisos_estoque', {
      produto_id: produto.id,
      variante_id: variante.id,
      produto_nome: produto.nome,
      produto_slug: produto.slug,
      tamanho: variante.tamanho,
      cor: variante.cor,
      email,
    });
  }
}
