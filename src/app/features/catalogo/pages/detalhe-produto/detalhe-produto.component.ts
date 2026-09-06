import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { FavoritosService } from '../../../../core/servicos/favoritos.service';
import { VistosRecentementeService } from '../../../../core/servicos/vistos-recentemente.service';
import { SeoService } from '../../../../core/servicos/seo.service';
import { FaixaMedida } from '../../../../core/modelos/produto.model';
import { corParaEstiloSwatch } from '../../../../core/utilitarios/cor.util';
import { GaleriaProdutoComponent } from '../../../../shared/componentes/galeria-produto/galeria-produto.component';
import { ModalComponent } from '../../../../shared/componentes/modal/modal.component';
import { VistosRecentementeComponent } from '../../../../shared/componentes/vistos-recentemente/vistos-recentemente.component';

const GUIA_MEDIDAS_PADRAO: FaixaMedida[] = [
  { tamanho: 'P', larguraCm: 48, comprimentoCm: 68 },
  { tamanho: 'M', larguraCm: 51, comprimentoCm: 70 },
  { tamanho: 'G', larguraCm: 54, comprimentoCm: 72 },
  { tamanho: 'GG', larguraCm: 57, comprimentoCm: 74 },
];

@Component({
  selector: 'app-detalhe-produto',
  standalone: true,
  imports: [GaleriaProdutoComponent, ModalComponent, VistosRecentementeComponent],
  templateUrl: './detalhe-produto.component.html',
  styleUrl: './detalhe-produto.component.scss',
})
export class DetalheProdutoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly favoritosService = inject(FavoritosService);
  private readonly vistosRecentementeService = inject(VistosRecentementeService);
  private readonly seoService = inject(SeoService);

  private readonly slugProduto$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? '')
  );

  /** Diferencia "ainda carregando" de "não encontrado" — sem isso, o template mostraria a
   * mensagem de erro por um instante em toda navegação, já que `produto()` fica `undefined`
   * tanto antes da resposta chegar quanto quando o produto de fato não existe. */
  readonly carregando = signal(true);

  readonly produto = toSignal(
    this.slugProduto$.pipe(
      tap(() => this.carregando.set(true)),
      switchMap((slug) => this.catalogoRepositorio.obterProdutoPorSlug(slug)),
      tap(() => this.carregando.set(false))
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

  /** Índice, dentro de `produto.imagens`, da primeira foto da cor selecionada — usado para
   * centralizar a imagem principal da galeria sem remover as demais fotos das miniaturas. */
  readonly indiceImagemDaCor = computed<number | null>(() => {
    const produto = this.produto();
    const cor = this.corSelecionada();
    if (!produto || !cor) return null;
    const fotosDaCor = produto.imagensPorCor?.[cor];
    if (!fotosDaCor || fotosDaCor.length === 0) return null;
    const indice = produto.imagens.indexOf(fotosDaCor[0]);
    return indice >= 0 ? indice : null;
  });

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

  constructor() {
    effect(() => {
      const produto = this.produto();
      if (produto) {
        // untracked: registrarVisita lê e escreve signals do VistosRecentementeService;
        // sem isso, o efeito passa a depender delas também e reagenda a si mesmo a cada
        // escrita (novo array = nova referência), entrando em loop infinito e travando a aba.
        untracked(() => this.vistosRecentementeService.registrarVisita(produto));
        this.seoService.definir({
          titulo: produto.nome,
          descricao: produto.descricao,
          imagem: produto.imagens[0],
          tipo: 'product',
        });
      }
    });
  }

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

  readonly favoritado = computed(() => {
    const produto = this.produto();
    return produto ? this.favoritosService.estaFavoritado(produto.id) : false;
  });

  alternarFavorito(): void {
    const produto = this.produto();
    if (produto) {
      this.favoritosService.alternar(produto);
    }
  }

  abrirGuiaMedidas(): void {
    this.guiaMedidasAberto.set(true);
  }

  fecharGuiaMedidas(): void {
    this.guiaMedidasAberto.set(false);
  }
}
