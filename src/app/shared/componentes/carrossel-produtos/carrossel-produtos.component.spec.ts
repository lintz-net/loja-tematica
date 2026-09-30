import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CarrosselProdutosComponent } from './carrossel-produtos.component';
import { Produto } from '../../../core/modelos/produto.model';
import { CatalogoRepositorio } from '../../../core/servicos/catalogo.repositorio';

function produto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta X',
    slug: 'camiseta-x',
    descricao: '',
    precoBase: 50,
    categorias: ['geek'],
    imagens: ['foto.webp'],
    variantes: [{ id: 'v1', produtoId: 'prod-1', tamanho: 'M', cor: 'Preto', sku: 'SKU1', quantidadeEstoque: 5 }],
    destaque: false,
    ...sobrescritas,
  };
}

describe('CarrosselProdutosComponent', () => {
  let fixture: ComponentFixture<CarrosselProdutosComponent>;
  let comp: CarrosselProdutosComponent;
  let trilhoFake: {
    clientWidth: number;
    scrollWidth: number;
    scrollLeft: number;
    scrollBy: jasmine.Spy;
    scrollTo: jasmine.Spy;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CarrosselProdutosComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: CatalogoRepositorio, useValue: jasmine.createSpyObj('CatalogoRepositorio', ['obterProdutos']) },
      ],
    });
    fixture = TestBed.createComponent(CarrosselProdutosComponent);
    comp = fixture.componentInstance;
    comp.produtos = [produto({ id: '1' }), produto({ id: '2' }), produto({ id: '3' })];

    // Substitui o elemento real (cujo layout no Karma não dá pra controlar de forma
    // confiável) por um fake com as dimensões que o teste precisa, mesmo padrão de outros
    // specs deste projeto que trocam APIs de DOM/browser por spies.
    trilhoFake = {
      clientWidth: 300,
      scrollWidth: 900,
      scrollLeft: 0,
      scrollBy: jasmine.createSpy('scrollBy'),
      scrollTo: jasmine.createSpy('scrollTo'),
    };
    // ResizeObserver real rejeita `.observe()` num objeto que não é um Element de verdade —
    // como o teste troca o trilho por um fake (layout do Karma não dá pra controlar de forma
    // confiável), troca o observer também por um no-op.
    spyOn(window, 'ResizeObserver').and.returnValue({
      observe: () => {},
      unobserve: () => {},
      disconnect: () => {},
    } as unknown as ResizeObserver);

    fixture.detectChanges();
    (comp as unknown as { trilho: { nativeElement: typeof trilhoFake } }).trilho = {
      nativeElement: trilhoFake,
    };
  });

  it('calcula o total de páginas a partir da largura do trilho e do conteúdo rolável', () => {
    comp.ngAfterViewInit();

    expect(comp.totalPaginas()).toBe(3);
    expect(comp.paginas()).toEqual([0, 1, 2]);
  });

  it('atualiza a página atual conforme o scroll', () => {
    comp.ngAfterViewInit();

    trilhoFake.scrollLeft = 300;
    comp.onScroll();
    expect(comp.paginaAtual()).toBe(1);

    trilhoFake.scrollLeft = 600;
    comp.onScroll();
    expect(comp.paginaAtual()).toBe(2);
  });

  it('anterior/proximo rolam uma tela inteira (largura do trilho)', () => {
    comp.ngAfterViewInit();

    comp.proximo();
    expect(trilhoFake.scrollBy).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });

    comp.anterior();
    expect(trilhoFake.scrollBy).toHaveBeenCalledWith({ left: -300, behavior: 'smooth' });
  });

  it('irParaPagina rola direto pra posição daquela página', () => {
    comp.ngAfterViewInit();

    comp.irParaPagina(2);

    expect(trilhoFake.scrollTo).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' });
  });

  it('não quebra quando o trilho ainda não tem largura (SSR/render inicial)', () => {
    trilhoFake.clientWidth = 0;

    expect(() => comp.ngAfterViewInit()).not.toThrow();
    expect(comp.totalPaginas()).toBe(1);
  });
});
