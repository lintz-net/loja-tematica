import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { CartaoProdutoComponent } from '../../../../shared/componentes/cartao-produto/cartao-produto.component';

@Component({
  selector: 'app-listagem',
  standalone: true,
  imports: [CartaoProdutoComponent, RouterLink],
  templateUrl: './listagem.component.html',
  styleUrl: './listagem.component.scss',
})
export class ListagemComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);

  readonly categorias = toSignal(this.catalogoRepositorio.obterCategorias(), {
    initialValue: [],
  });

  private readonly slugCategoria$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? '')
  );

  readonly termoBusca = signal('');

  readonly categoriaAtual = toSignal(
    this.slugCategoria$.pipe(
      switchMap((slug) => this.catalogoRepositorio.obterCategoriaPorSlug(slug))
    ),
    { initialValue: undefined }
  );

  private readonly produtosDaCategoria = toSignal(
    this.slugCategoria$.pipe(
      switchMap((slug) => this.catalogoRepositorio.obterProdutosPorCategoria(slug))
    ),
    { initialValue: [] }
  );

  readonly produtosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    if (!termo) {
      return this.produtosDaCategoria();
    }
    return this.produtosDaCategoria().filter((produto) =>
      produto.nome.toLowerCase().includes(termo)
    );
  });

  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
  }
}
