import { Component, Input, computed, inject } from '@angular/core';
import { VistosRecentementeService } from '../../../core/servicos/vistos-recentemente.service';
import { CartaoProdutoComponent } from '../cartao-produto/cartao-produto.component';

@Component({
  selector: 'app-vistos-recentemente',
  standalone: true,
  imports: [CartaoProdutoComponent],
  templateUrl: './vistos-recentemente.component.html',
  styleUrl: './vistos-recentemente.component.scss',
})
export class VistosRecentementeComponent {
  private readonly vistosRecentementeService = inject(VistosRecentementeService);

  /** Produto da página atual, pra não aparecer na própria lista de "vistos recentemente". */
  @Input() excluirProdutoId: string | null = null;

  readonly produtos = computed(() =>
    this.vistosRecentementeService
      .produtosVistos()
      .filter((produto) => produto.id !== this.excluirProdutoId)
  );
}
