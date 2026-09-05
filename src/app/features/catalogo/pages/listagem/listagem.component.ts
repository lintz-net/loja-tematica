import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { SeoService } from '../../../../core/servicos/seo.service';
import { CartaoProdutoComponent } from '../../../../shared/componentes/cartao-produto/cartao-produto.component';
import { CartaoProdutoEsqueletoComponent } from '../../../../shared/componentes/cartao-produto-esqueleto/cartao-produto-esqueleto.component';

@Component({
  selector: 'app-listagem',
  standalone: true,
  imports: [CartaoProdutoComponent, CartaoProdutoEsqueletoComponent, RouterLink],
  templateUrl: './listagem.component.html',
  styleUrl: './listagem.component.scss',
})
export class ListagemComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly seoService = inject(SeoService);

  readonly categorias = toSignal(this.catalogoRepositorio.obterCategorias(), {
    initialValue: [],
  });

  private readonly slugCategoria$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? '')
  );

  readonly termoBusca = signal('');
  readonly carregando = signal(true);

  readonly categoriaAtual = toSignal(
    this.slugCategoria$.pipe(
      switchMap((slug) => this.catalogoRepositorio.obterCategoriaPorSlug(slug))
    ),
    { initialValue: undefined }
  );

  private readonly produtosDaCategoria = toSignal(
    this.slugCategoria$.pipe(
      tap(() => this.carregando.set(true)),
      switchMap((slug) => this.catalogoRepositorio.obterProdutosPorCategoria(slug)),
      tap(() => this.carregando.set(false))
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

  constructor() {
    effect(() => {
      const categoria = this.categoriaAtual();
      if (categoria) {
        this.seoService.definir({ titulo: categoria.nome, descricao: categoria.descricaoCurta });
      }
    });
  }
}
