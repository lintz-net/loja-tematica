import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { AdminProdutosComponent } from './admin-produtos.component';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminProdutoService } from '../../../../core/servicos/admin-produto.service';
import { Produto } from '../../../../core/modelos/produto.model';
import { Categoria } from '../../../../core/modelos/categoria.model';

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Batman',
    slug: 'camiseta-batman',
    descricao: 'Descrição',
    precoBase: 50,
    categorias: [],
    imagens: [],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

function criarCategoria(sobrescritas: Partial<Categoria> = {}): Categoria {
  return {
    id: 'geek',
    nome: 'Geek',
    slug: 'geek',
    corTema: '#7b2ff7',
    descricaoCurta: 'Games e HQs',
    icone: '🕹️',
    ...sobrescritas,
  };
}

describe('AdminProdutosComponent', () => {
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;
  let adminProdutoServiceSpy: jasmine.SpyObj<AdminProdutoService>;

  function configurar(): ComponentFixture<AdminProdutosComponent> {
    TestBed.configureTestingModule({
      imports: [AdminProdutosComponent],
      providers: [
        { provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy },
        { provide: AdminProdutoService, useValue: adminProdutoServiceSpy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(AdminProdutosComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', [
      'obterProdutos',
      'obterCategorias',
    ]);
    adminProdutoServiceSpy = jasmine.createSpyObj('AdminProdutoService', ['atualizar', 'excluir']);
    catalogoRepositorioSpy.obterCategorias.and.returnValue(of([criarCategoria()]));
  });

  it('carrega e ordena os produtos por nome', () => {
    catalogoRepositorioSpy.obterProdutos.and.returnValue(
      of([criarProduto({ id: 'b', nome: 'Zebra' }), criarProduto({ id: 'a', nome: 'Abelha' })])
    );

    const fixture = configurar();

    expect(fixture.componentInstance.carregando()).toBeFalse();
    expect(fixture.componentInstance.produtos().map((p) => p.nome)).toEqual(['Abelha', 'Zebra']);
  });

  it('mostra erro quando a listagem falha', () => {
    catalogoRepositorioSpy.obterProdutos.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar');
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });

  describe('filtro "sem categoria"', () => {
    it('quantidadeSemCategoria conta só produtos com array de categorias vazio', () => {
      catalogoRepositorioSpy.obterProdutos.and.returnValue(
        of([
          criarProduto({ id: '1', categorias: [] }),
          criarProduto({ id: '2', categorias: ['geek'] }),
          criarProduto({ id: '3', categorias: [] }),
        ])
      );

      const fixture = configurar();

      expect(fixture.componentInstance.quantidadeSemCategoria()).toBe(2);
    });

    it('produtosFiltrados mostra tudo por padrão, e só os sem categoria quando o filtro está ativo', () => {
      catalogoRepositorioSpy.obterProdutos.and.returnValue(
        of([
          criarProduto({ id: '1', nome: 'A', categorias: [] }),
          criarProduto({ id: '2', nome: 'B', categorias: ['geek'] }),
        ])
      );
      const fixture = configurar();
      const comp = fixture.componentInstance;

      expect(comp.produtosFiltrados().length).toBe(2);

      comp.filtro.set('sem-categoria');

      expect(comp.produtosFiltrados().length).toBe(1);
      expect(comp.produtosFiltrados()[0].id).toBe('1');
    });
  });

  describe('atribuirCategoria', () => {
    it('não faz nada quando o slug está vazio (opção "escolher…")', () => {
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([criarProduto()]));
      const fixture = configurar();

      fixture.componentInstance.atribuirCategoria(criarProduto(), '');

      expect(adminProdutoServiceSpy.atualizar).not.toHaveBeenCalled();
    });

    it('substitui as categorias do produto pela escolhida e atualiza a lista local', () => {
      const produto = criarProduto({ id: '1', categorias: [] });
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produto]));
      const produtoAtualizado = { ...produto, categorias: ['geek'] };
      adminProdutoServiceSpy.atualizar.and.returnValue(of(produtoAtualizado));
      const fixture = configurar();

      fixture.componentInstance.atribuirCategoria(produto, 'geek');

      expect(adminProdutoServiceSpy.atualizar).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: '1', categorias: ['geek'] })
      );
      expect(fixture.componentInstance.produtos()[0].categorias).toEqual(['geek']);
      expect(fixture.componentInstance.atribuindoCategoriaId()).toBeNull();
    });

    it('mostra erro quando a atribuição falha', () => {
      const produto = criarProduto();
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produto]));
      adminProdutoServiceSpy.atualizar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.atribuirCategoria(produto, 'geek');

      expect(fixture.componentInstance.erro()).toContain('Não foi possível atribuir a categoria');
      expect(fixture.componentInstance.atribuindoCategoriaId()).toBeNull();
    });
  });

  describe('excluir', () => {
    it('não exclui quando o admin cancela a confirmação', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const produto = criarProduto();
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produto]));
      const fixture = configurar();

      fixture.componentInstance.excluir(produto);

      expect(adminProdutoServiceSpy.excluir).not.toHaveBeenCalled();
    });

    it('remove o produto da lista quando confirmado e a exclusão dá certo', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const produto = criarProduto({ id: '1' });
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produto]));
      adminProdutoServiceSpy.excluir.and.returnValue(of(undefined));
      const fixture = configurar();

      fixture.componentInstance.excluir(produto);

      expect(fixture.componentInstance.produtos()).toEqual([]);
      expect(fixture.componentInstance.excluindoId()).toBeNull();
    });

    it('mostra erro quando a exclusão falha', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const produto = criarProduto({ id: '1' });
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produto]));
      adminProdutoServiceSpy.excluir.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.excluir(produto);

      expect(fixture.componentInstance.erro()).toContain('Não foi possível excluir');
      expect(fixture.componentInstance.produtos().length).toBe(1); // continua na lista
    });
  });
});
