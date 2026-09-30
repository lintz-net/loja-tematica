import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Produto } from '../../../core/modelos/produto.model';
import { CartaoProdutoComponent } from '../cartao-produto/cartao-produto.component';

/** Carrossel de produtos por scroll horizontal (scroll-snap) — ao contrário de
 * `app-carrossel` (banners, 1 slide por vez com autoplay), aqui vários cards ficam visíveis
 * lado a lado e o usuário navega por scroll/setas/bolinhas; sem autoplay, já que produtos não
 * precisam trocar sozinhos como um banner promocional. */
@Component({
  selector: 'app-carrossel-produtos',
  standalone: true,
  imports: [CartaoProdutoComponent],
  templateUrl: './carrossel-produtos.component.html',
  styleUrl: './carrossel-produtos.component.scss',
})
export class CarrosselProdutosComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) produtos: Produto[] = [];

  @ViewChild('trilho') trilho!: ElementRef<HTMLElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private resizeObserver: ResizeObserver | null = null;

  /** "Página" = uma tela cheia de cards (não um card por vez) — bate com o quanto `anterior`/
   * `proximo` rolam (a largura visível do trilho inteira). */
  readonly paginaAtual = signal(0);
  readonly totalPaginas = signal(1);
  readonly paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i));

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.recalcularPaginas();
    this.resizeObserver = new ResizeObserver(() => this.recalcularPaginas());
    this.resizeObserver.observe(this.trilho.nativeElement);
  }

  ngOnChanges(): void {
    // `produtos` pode chegar/mudar de forma assíncrona (ex.: fetch de "produtos
    // relacionados") depois que o ViewChild já existe — recalcula a paginação quando isso
    // acontecer. Antes do ngAfterViewInit o `trilho` ainda não existe, então só agenda se já
    // existir (primeira mudança de input chega antes da view estar pronta).
    if (this.isBrowser && this.trilho) {
      queueMicrotask(() => this.recalcularPaginas());
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private recalcularPaginas(): void {
    const largura = this.trilho.nativeElement.clientWidth;
    if (largura === 0) return;
    const totalRolavel = this.trilho.nativeElement.scrollWidth;
    this.totalPaginas.set(Math.max(1, Math.round(totalRolavel / largura)));
    this.atualizarPaginaAtual();
  }

  onScroll(): void {
    this.atualizarPaginaAtual();
  }

  private atualizarPaginaAtual(): void {
    const largura = this.trilho.nativeElement.clientWidth;
    if (largura === 0) return;
    const pagina = Math.round(this.trilho.nativeElement.scrollLeft / largura);
    this.paginaAtual.set(Math.min(pagina, this.totalPaginas() - 1));
  }

  private rolar(distancia: number): void {
    this.trilho.nativeElement.scrollBy({ left: distancia, behavior: 'smooth' });
  }

  anterior(): void {
    this.rolar(-this.trilho.nativeElement.clientWidth);
  }

  proximo(): void {
    this.rolar(this.trilho.nativeElement.clientWidth);
  }

  irParaPagina(pagina: number): void {
    this.trilho.nativeElement.scrollTo({
      left: pagina * this.trilho.nativeElement.clientWidth,
      behavior: 'smooth',
    });
  }
}
