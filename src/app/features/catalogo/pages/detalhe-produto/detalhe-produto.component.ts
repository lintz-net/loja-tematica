import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { FaixaMedida } from '../../../../core/modelos/produto.model';
import { corParaEstiloSwatch } from '../../../../core/utilitarios/cor.util';
import { GaleriaProdutoComponent } from '../../../../shared/componentes/galeria-produto/galeria-produto.component';
import { ModalComponent } from '../../../../shared/componentes/modal/modal.component';

const GUIA_MEDIDAS_PADRAO: FaixaMedida[] = [
  { tamanho: 'P', larguraCm: 48, comprimentoCm: 68 },
  { tamanho: 'M', larguraCm: 51, comprimentoCm: 70 },
  { tamanho: 'G', larguraCm: 54, comprimentoCm: 72 },
  { tamanho: 'GG', larguraCm: 57, comprimentoCm: 74 },
];

@Component({
  selector: 'app-detalhe-produto',
  standalone: true,
  imports: [GaleriaProdutoComponent, ModalComponent],
  templateUrl: './detalhe-produto.component.html',
  styleUrl: './detalhe-produto.component.scss',
})
export class DetalheProdutoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly carrinhoService = inject(CarrinhoService);

  private readonly slugProduto$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? '')
  );

  readonly produto = toSignal(
    this.slugProduto$.pipe(
      switchMap((slug) => this.catalogoRepositorio.obterProdutoPorSlug(slug))
    ),
    { initialValue: undefined }
  );

  readonly tamanhosDisponiveis = computed(() => {
    const variantes = this.produto()?.variantes ?? [];
    return Array.from(new Set(variantes.map((v) => v.tamanho)));
  });

  readonly coresDisponiveis = computed(() => {
    const variantes = this.produto()?.variantes ?? [];
    return Array.from(new Set(variantes.map((v) => v.cor)));
  });

  readonly tamanhoSelecionado = signal<string | null>(null);
  readonly corSelecionada = signal<string | null>(null);
  readonly quantidade = signal(1);
  readonly itemAdicionado = signal(false);
  readonly guiaMedidasAberto = signal(false);

  /** Tamanho é considerado indisponível quando não há nenhuma variante com estoque
   * para ele — respeitando a cor já escolhida, quando houver. */
  readonly tamanhosComDisponibilidade = computed(() => {
    const variantes = this.produto()?.variantes ?? [];
    const cor = this.corSelecionada();
    return this.tamanhosDisponiveis().map((tamanho) => ({
      tamanho,
      disponivel: variantes.some(
        (v) => v.tamanho === tamanho && (!cor || v.cor === cor) && v.quantidadeEstoque > 0
      ),
    }));
  });

  readonly coresComDisponibilidade = computed(() => {
    const variantes = this.produto()?.variantes ?? [];
    const tamanho = this.tamanhoSelecionado();
    return this.coresDisponiveis().map((cor) => ({
      cor,
      estiloSwatch: corParaEstiloSwatch(cor),
      disponivel: variantes.some(
        (v) => v.cor === cor && (!tamanho || v.tamanho === tamanho) && v.quantidadeEstoque > 0
      ),
    }));
  });

  readonly exibirGuiaMedidas = computed(() => {
    const tamanhos = this.tamanhosDisponiveis();
    return tamanhos.length > 1 || (tamanhos.length === 1 && tamanhos[0] !== 'Único');
  });

  readonly guiaMedidas = computed(() => this.produto()?.guiaMedidas ?? GUIA_MEDIDAS_PADRAO);

  readonly varianteSelecionada = computed(() => {
    const variantes = this.produto()?.variantes ?? [];
    return variantes.find(
      (v) => v.tamanho === this.tamanhoSelecionado() && v.cor === this.corSelecionada()
    );
  });

  readonly precoExibido = computed(() => {
    const produto = this.produto();
    const variante = this.varianteSelecionada();
    if (!produto) return 0;
    return variante?.precoOverride ?? produto.precoBase;
  });

  selecionarTamanho(tamanho: string, disponivel: boolean): void {
    if (!disponivel) return;
    this.tamanhoSelecionado.set(tamanho);
    this.itemAdicionado.set(false);
  }

  selecionarCor(cor: string, disponivel: boolean): void {
    if (!disponivel) return;
    this.corSelecionada.set(cor);
    this.itemAdicionado.set(false);
  }

  alterarQuantidade(delta: number): void {
    this.quantidade.update((atual) => Math.max(1, atual + delta));
  }

  adicionarAoCarrinho(): void {
    const produto = this.produto();
    const variante = this.varianteSelecionada();
    if (!produto || !variante) return;

    this.carrinhoService.adicionarItem(produto, variante, this.quantidade());
    this.itemAdicionado.set(true);
  }

  irParaCarrinho(): void {
    this.router.navigate(['/carrinho']);
  }

  abrirGuiaMedidas(): void {
    this.guiaMedidasAberto.set(true);
  }

  fecharGuiaMedidas(): void {
    this.guiaMedidasAberto.set(false);
  }
}
