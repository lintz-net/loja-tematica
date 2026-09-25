import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminCategoriasComponent } from './admin-categorias.component';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminCategoriaService } from '../../../../core/servicos/admin-categoria.service';
import { Categoria } from '../../../../core/modelos/categoria.model';
import { Produto } from '../../../../core/modelos/produto.model';

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

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Produto',
    slug: 'produto',
    descricao: '',
    precoBase: 10,
    categorias: [],
    imagens: [],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

describe('AdminCategoriasComponent', () => {
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;
  let adminCategoriaServiceSpy: jasmine.SpyObj<AdminCategoriaService>;

  function configurar(): ComponentFixture<AdminCategoriasComponent> {
    TestBed.configureTestingModule({
      imports: [AdminCategoriasComponent],
      providers: [
        { provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy },
        { provide: AdminCategoriaService, useValue: adminCategoriaServiceSpy },
      ],
    });
    const fixture = TestBed.createComponent(AdminCategoriasComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', [
      'obterCategorias',
      'obterProdutos',
    ]);
    adminCategoriaServiceSpy = jasmine.createSpyObj('AdminCategoriaService', [
      'criar',
      'atualizar',
      'excluir',
    ]);
    catalogoRepositorioSpy.obterCategorias.and.returnValue(of([criarCategoria()]));
    catalogoRepositorioSpy.obterProdutos.and.returnValue(of([]));
  });

  it('carrega as categorias e conta produtos por categoria', () => {
    catalogoRepositorioSpy.obterProdutos.and.returnValue(
      of([
        criarProduto({ categorias: ['geek'] }),
        criarProduto({ categorias: ['geek', 'musica'] }),
        criarProduto({ categorias: [] }),
      ])
    );

    const fixture = configurar();
    const comp = fixture.componentInstance;

    expect(comp.carregando()).toBeFalse();
    expect(comp.categorias()).toEqual([criarCategoria()]);
    expect(comp.quantidadeProdutos(criarCategoria())).toBe(2);
    expect(comp.quantidadeProdutos(criarCategoria({ slug: 'musica' }))).toBe(1);
    expect(comp.quantidadeProdutos(criarCategoria({ slug: 'nao-usada' }))).toBe(0);
  });

  it('mostra erro quando a listagem de categorias falha', () => {
    catalogoRepositorioSpy.obterCategorias.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar');
  });

  describe('gerar slug automático', () => {
    it('gera o slug a partir do nome enquanto não editado manualmente', () => {
      const fixture = configurar();
      fixture.componentInstance.atualizarNovoNome('Ação & Aventura');

      expect(fixture.componentInstance.novoSlug()).toBe('acao-aventura');
    });

    it('para de seguir o nome depois que o slug é editado à mão', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovoSlug('meu-slug-fixo');
      comp.atualizarNovoNome('Outro Nome Completamente Diferente');

      expect(comp.novoSlug()).toBe('meu-slug-fixo');
    });
  });

  describe('podeCriar', () => {
    it('exige nome, slug e ícone preenchidos', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      expect(comp.podeCriar()).toBeFalse();

      comp.atualizarNovoNome('Personagens');
      expect(comp.podeCriar()).toBeFalse(); // falta ícone

      comp.novoIcone.set('🎭');
      expect(comp.podeCriar()).toBeTrue();
    });
  });

  describe('criar', () => {
    it('cria a categoria e limpa o formulário', () => {
      const nova = criarCategoria({ id: 'personagens', slug: 'personagens', nome: 'Personagens', icone: '🎭' });
      adminCategoriaServiceSpy.criar.and.returnValue(of(nova));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovoNome('Personagens');
      comp.novoIcone.set('🎭');

      comp.criar();

      expect(adminCategoriaServiceSpy.criar).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'personagens', slug: 'personagens', icone: '🎭' })
      );
      expect(comp.categorias()).toContain(nova);
      expect(comp.novoNome()).toBe('');
      expect(comp.novoIcone()).toBe('');
      expect(comp.salvando()).toBeFalse();
    });

    it('não chama o serviço quando o formulário está incompleto', () => {
      const fixture = configurar();
      fixture.componentInstance.criar();

      expect(adminCategoriaServiceSpy.criar).not.toHaveBeenCalled();
    });

    it('mostra erro quando a criação falha (ex.: slug duplicado)', () => {
      adminCategoriaServiceSpy.criar.and.returnValue(throwError(() => new Error('duplicado')));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovoNome('Personagens');
      comp.novoIcone.set('🎭');

      comp.criar();

      expect(comp.erro()).toContain('Não foi possível criar');
      expect(comp.salvando()).toBeFalse();
    });
  });

  describe('edição inline', () => {
    it('iniciarEdicao popula os campos ed* com a categoria', () => {
      const fixture = configurar();
      fixture.componentInstance.iniciarEdicao(criarCategoria());

      const comp = fixture.componentInstance;
      expect(comp.idEmEdicao()).toBe('geek');
      expect(comp.edNome()).toBe('Geek');
      expect(comp.edIcone()).toBe('🕹️');
    });

    it('cancelarEdicao sai do modo de edição', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.iniciarEdicao(criarCategoria());

      comp.cancelarEdicao();

      expect(comp.idEmEdicao()).toBeNull();
    });

    it('salvarEdicao atualiza a categoria na lista e sai do modo de edição', () => {
      const categoriaAtualizada = criarCategoria({ nome: 'Geek & Nerd' });
      adminCategoriaServiceSpy.atualizar.and.returnValue(of(categoriaAtualizada));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.iniciarEdicao(criarCategoria());
      comp.edNome.set('Geek & Nerd');

      comp.salvarEdicao(criarCategoria());

      expect(comp.categorias()[0].nome).toBe('Geek & Nerd');
      expect(comp.idEmEdicao()).toBeNull();
    });

    it('mostra erro quando salvar a edição falha', () => {
      adminCategoriaServiceSpy.atualizar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.iniciarEdicao(criarCategoria());

      comp.salvarEdicao(criarCategoria());

      expect(comp.erro()).toContain('Não foi possível salvar');
    });
  });

  describe('excluir', () => {
    it('bloqueia a exclusão quando a categoria está em uso, sem nem confirmar', () => {
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([criarProduto({ categorias: ['geek'] })]));
      const confirmSpy = spyOn(window, 'confirm');
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCategoria());

      expect(fixture.componentInstance.erro()).toContain('em uso em 1 produto');
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(adminCategoriaServiceSpy.excluir).not.toHaveBeenCalled();
    });

    it('não exclui quando o admin cancela a confirmação', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCategoria());

      expect(adminCategoriaServiceSpy.excluir).not.toHaveBeenCalled();
    });

    it('exclui a categoria sem uso quando confirmado', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminCategoriaServiceSpy.excluir.and.returnValue(of(undefined));
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCategoria());

      expect(fixture.componentInstance.categorias()).toEqual([]);
      expect(fixture.componentInstance.idExcluindo()).toBeNull();
    });

    it('mostra erro quando a exclusão falha', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminCategoriaServiceSpy.excluir.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCategoria());

      expect(fixture.componentInstance.erro()).toContain('Não foi possível excluir');
    });
  });
});
