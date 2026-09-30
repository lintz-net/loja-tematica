import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { Produto } from '../../../core/modelos/produto.model';
import { CatalogoRepositorio } from '../../../core/servicos/catalogo.repositorio';
import { CarrosselProdutosComponent } from '../carrossel-produtos/carrossel-produtos.component';

/** "Quem comprou também levou" — na prática, mesma categoria do produto atual (não existe
 * dado real de coocorrência de compra, ver comentário em CatalogoRepositorio). Reaproveitado
 * pelo Router quando o cliente navega de um produto pro outro (mesma instância do
 * componente) — por isso o `@Input` precisa de `ngOnChanges` empurrando pra dentro de um
 * signal, e não só ser lido direto: sem isso a lista ficaria travada no primeiro produto
 * visitado. */
@Component({
  selector: 'app-produtos-relacionados',
  standalone: true,
  imports: [CarrosselProdutosComponent],
  templateUrl: './produtos-relacionados.component.html',
  styleUrl: './produtos-relacionados.component.scss',
})
export class ProdutosRelacionadosComponent implements OnChanges {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);

  @Input({ required: true }) produto!: Produto;

  private readonly produtoAtual = signal<Produto | null>(null);

  readonly produtosRelacionados = toSignal(
    toObservable(this.produtoAtual).pipe(
      switchMap((produto) =>
        produto ? this.catalogoRepositorio.obterProdutosRelacionados(produto) : of([])
      )
    ),
    { initialValue: [] }
  );

  ngOnChanges(): void {
    this.produtoAtual.set(this.produto);
  }
}
