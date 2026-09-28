import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProdutosRelacionadosComponent } from './produtos-relacionados.component';
import { CatalogoRepositorio } from '../../../core/servicos/catalogo.repositorio';
import { Produto } from '../../../core/modelos/produto.model';

function produto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Atual',
    slug: 'camiseta-atual',
    descricao: '',
    precoBase: 50,
    categorias: ['geek'],
    imagens: ['foto.webp'],
    variantes: [{ id: 'v1', produtoId: 'prod-1', tamanho: 'M', cor: 'Preto', sku: 'SKU1', quantidadeEstoque: 5 }],
    destaque: false,
    ...sobrescritas,
  };
}

describe('ProdutosRelacionadosComponent', () => {
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;

  function configurar(): ComponentFixture<ProdutosRelacionadosComponent> {
    TestBed.configureTestingModule({
      imports: [ProdutosRelacionadosComponent],
      providers: [provideRouter([]), { provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy }],
    });
    return TestBed.createComponent(ProdutosRelacionadosComponent);
  }

  beforeEach(() => {
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', ['obterProdutosRelacionados']);
  });

  it('busca relacionados pro produto recebido e expõe no signal', () => {
    const relacionado = produto({ id: 'prod-2', slug: 'camiseta-relacionada' });
    catalogoRepositorioSpy.obterProdutosRelacionados.and.returnValue(of([relacionado]));
    const fixture = configurar();
    fixture.componentInstance.produto = produto();

    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();

    expect(catalogoRepositorioSpy.obterProdutosRelacionados).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 'prod-1' })
    );
    expect(fixture.componentInstance.produtosRelacionados()).toEqual([relacionado]);
  });

  it('busca de novo quando o produto muda (navegação entre produtos, mesma instância)', () => {
    const relacionadoA = produto({ id: 'prod-a' });
    const relacionadoB = produto({ id: 'prod-b' });
    catalogoRepositorioSpy.obterProdutosRelacionados.and.returnValues(of([relacionadoA]), of([relacionadoB]));
    const fixture = configurar();
    const comp = fixture.componentInstance;

    comp.produto = produto({ id: 'prod-1' });
    comp.ngOnChanges();
    fixture.detectChanges();
    expect(comp.produtosRelacionados()).toEqual([relacionadoA]);

    comp.produto = produto({ id: 'prod-3' });
    comp.ngOnChanges();
    fixture.detectChanges();
    expect(comp.produtosRelacionados()).toEqual([relacionadoB]);
  });

  it('não mostra a seção (template) quando não há relacionados', () => {
    catalogoRepositorioSpy.obterProdutosRelacionados.and.returnValue(of([]));
    const fixture = configurar();
    fixture.componentInstance.produto = produto();

    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.produtos-relacionados')).toBeNull();
  });
});
