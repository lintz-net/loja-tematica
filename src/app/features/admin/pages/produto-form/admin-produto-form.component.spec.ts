import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminProdutoFormComponent } from './admin-produto-form.component';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminProdutoService } from '../../../../core/servicos/admin-produto.service';
import { NotificarEstoqueService } from '../../../../core/servicos/notificar-estoque.service';
import { Produto } from '../../../../core/modelos/produto.model';
import { Categoria } from '../../../../core/modelos/categoria.model';

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Batman',
    slug: 'camiseta-batman',
    descricao: 'Descrição',
    precoBase: 50,
    categorias: ['geek'],
    imagens: ['/foto1.webp'],
    variantes: [
      {
        id: 'v1',
        produtoId: 'prod-1',
        sku: 'CAMISETA-BATMAN-M-PRETO',
        tamanho: 'M',
        cor: 'Preto',
        quantidadeEstoque: 5,
      },
    ],
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

describe('AdminProdutoFormComponent', () => {
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;
  let adminProdutoServiceSpy: jasmine.SpyObj<AdminProdutoService>;
  let notificarEstoqueServiceSpy: jasmine.SpyObj<NotificarEstoqueService>;

  function configurar(idParam: string | null): {
    fixture: ComponentFixture<AdminProdutoFormComponent>;
    navigateSpy: jasmine.Spy;
  } {
    TestBed.configureTestingModule({
      imports: [AdminProdutoFormComponent],
      providers: [
        provideRouter([]),
        { provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy },
        { provide: AdminProdutoService, useValue: adminProdutoServiceSpy },
        { provide: NotificarEstoqueService, useValue: notificarEstoqueServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(idParam ? { id: idParam } : {}) } },
        },
      ],
    });
    const navigateSpy = spyOn(TestBed.inject(Router), 'navigate');
    const fixture = TestBed.createComponent(AdminProdutoFormComponent);
    fixture.detectChanges();
    return { fixture, navigateSpy };
  }

  beforeEach(() => {
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', ['obterCategorias']);
    adminProdutoServiceSpy = jasmine.createSpyObj('AdminProdutoService', [
      'obterPorId',
      'criar',
      'atualizar',
      'enviarImagem',
      'enviarVideo',
      'excluirImagem',
    ]);
    notificarEstoqueServiceSpy = jasmine.createSpyObj('NotificarEstoqueService', [
      'notificarReposicao',
    ]);
    catalogoRepositorioSpy.obterCategorias.and.returnValue(of([criarCategoria()]));
  });

  describe('modo criação (sem id na rota)', () => {
    it('inicia com carregando=false e modoEdicao=false', () => {
      const { fixture } = configurar(null);

      expect(fixture.componentInstance.modoEdicao).toBeFalse();
      expect(fixture.componentInstance.carregando()).toBeFalse();
    });
  });

  describe('modo edição (com id na rota)', () => {
    it('carrega o produto e preenche o formulário', () => {
      adminProdutoServiceSpy.obterPorId.and.returnValue(of(criarProduto()));
      const { fixture } = configurar('prod-1');
      const comp = fixture.componentInstance;

      expect(adminProdutoServiceSpy.obterPorId).toHaveBeenCalledWith('prod-1');
      expect(comp.modoEdicao).toBeTrue();
      expect(comp.carregando()).toBeFalse();
      expect(comp.nome()).toBe('Camiseta Batman');
      expect(comp.slug()).toBe('camiseta-batman');
      expect(comp.categoriasSelecionadas().has('geek')).toBeTrue();
      expect(comp.variantes().length).toBe(1);
    });

    it('mostra erro quando o produto não é encontrado', () => {
      adminProdutoServiceSpy.obterPorId.and.returnValue(of(undefined));
      const { fixture } = configurar('prod-inexistente');

      expect(fixture.componentInstance.erro()).toBe('Produto não encontrado.');
      expect(fixture.componentInstance.carregando()).toBeFalse();
    });

    it('mostra erro quando a busca falha', () => {
      adminProdutoServiceSpy.obterPorId.and.returnValue(throwError(() => new Error('falhou')));
      const { fixture } = configurar('prod-1');

      expect(fixture.componentInstance.erro()).toBe('Não foi possível carregar o produto.');
      expect(fixture.componentInstance.carregando()).toBeFalse();
    });
  });

  describe('geração automática de slug', () => {
    it('gera o slug a partir do nome enquanto não editado manualmente', () => {
      const { fixture } = configurar(null);
      fixture.componentInstance.atualizarNome('Caneca Coringa & Batman');

      expect(fixture.componentInstance.slug()).toBe('caneca-coringa-batman');
    });

    it('para de seguir o nome depois que o slug é editado à mão', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.atualizarSlug('slug-fixo');
      comp.atualizarNome('Outro Nome');

      expect(comp.slug()).toBe('slug-fixo');
    });
  });

  describe('categorias', () => {
    it('alternarCategoria adiciona e remove do Set, categoriaSelecionada reflete o estado', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;

      comp.alternarCategoria('geek', true);
      expect(comp.categoriaSelecionada('geek')).toBeTrue();

      comp.alternarCategoria('geek', false);
      expect(comp.categoriaSelecionada('geek')).toBeFalse();
    });
  });

  describe('gerarVariantes', () => {
    it('não faz nada quando faltam tamanhos ou cores marcados', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.alternarTamanho('M', true);

      comp.gerarVariantes();

      expect(comp.variantes()).toEqual([]);
    });

    it('monta a matriz tamanho x cor', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.alternarTamanho('M', true);
      comp.alternarTamanho('G', true);
      comp.alternarCor('Preto', true);

      comp.gerarVariantes();

      expect(comp.variantes().length).toBe(2);
      expect(comp.variantes().map((v) => `${v.tamanho}::${v.cor}`).sort()).toEqual([
        'G::Preto',
        'M::Preto',
      ]);
    });

    it('preserva estoque/preço de variantes já existentes ao regenerar', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.alternarTamanho('M', true);
      comp.alternarCor('Preto', true);
      comp.gerarVariantes();
      comp.atualizarVariante(comp.variantes()[0].id, 'quantidadeEstoque', '99');

      comp.alternarCor('Branco', true);
      comp.gerarVariantes();

      const original = comp.variantes().find((v) => v.cor === 'Preto');
      expect(original?.quantidadeEstoque).toBe(99);
      expect(comp.variantes().length).toBe(2);
    });
  });

  describe('atualizarVariante', () => {
    it('atualiza quantidadeEstoque com fallback 0 se inválido', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.alternarTamanho('M', true);
      comp.alternarCor('Preto', true);
      comp.gerarVariantes();
      const id = comp.variantes()[0].id;

      comp.atualizarVariante(id, 'quantidadeEstoque', 'abc');

      expect(comp.variantes()[0].quantidadeEstoque).toBe(0);
    });

    it('atualiza precoOverride, com null quando vazio', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.alternarTamanho('M', true);
      comp.alternarCor('Preto', true);
      comp.gerarVariantes();
      const id = comp.variantes()[0].id;

      comp.atualizarVariante(id, 'precoOverride', '45.9');
      expect(comp.variantes()[0].precoOverride).toBe(45.9);

      comp.atualizarVariante(id, 'precoOverride', '');
      expect(comp.variantes()[0].precoOverride).toBeNull();
    });
  });

  describe('imagens', () => {
    it('removerImagem tira a imagem da lista e das imagensPorCor', () => {
      adminProdutoServiceSpy.excluirImagem.and.returnValue(of(undefined));
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.imagens.set(['/a.webp', '/b.webp']);
      comp.alternarImagemDaCor('Preto', '/a.webp', true);

      comp.removerImagem('/a.webp');

      expect(comp.imagens()).toEqual(['/b.webp']);
      expect(comp.imagemMarcadaParaCor('Preto', '/a.webp')).toBeFalse();
      expect(adminProdutoServiceSpy.excluirImagem).toHaveBeenCalledWith('/a.webp');
    });

    it('aoSoltarEm reordena as imagens movendo a arrastada pra posição de destino', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comp.imagens.set(['/a.webp', '/b.webp', '/c.webp']);

      comp.aoIniciarArraste(0);
      comp.aoSoltarEm(2);

      expect(comp.imagens()).toEqual(['/b.webp', '/c.webp', '/a.webp']);
      expect(comp.indiceArrastando()).toBeNull();
    });
  });

  describe('podeSalvar', () => {
    function comValoresMinimosValidos(comp: AdminProdutoFormComponent) {
      comp.atualizarNome('Produto Teste');
      comp.alternarCategoria('geek', true);
      comp.imagens.set(['/a.webp']);
      comp.alternarTamanho('M', true);
      comp.alternarCor('Preto', true);
      comp.gerarVariantes();
    }

    it('exige nome, slug, categoria, imagem e ao menos uma variante', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;

      expect(comp.podeSalvar()).toBeFalse();

      comValoresMinimosValidos(comp);

      expect(comp.podeSalvar()).toBeTrue();
    });

    it('é falso enquanto há envio de imagem ou vídeo em andamento', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comValoresMinimosValidos(comp);

      comp.enviandoImagem.set(true);
      expect(comp.podeSalvar()).toBeFalse();
      comp.enviandoImagem.set(false);

      comp.enviandoVideo.set(true);
      expect(comp.podeSalvar()).toBeFalse();
    });

    it('é falso quando o preço promocional não é menor que o preço base', () => {
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comValoresMinimosValidos(comp);
      comp.atualizarPrecoBase('50');
      comp.atualizarPrecoPromocional('60');

      expect(comp.podeSalvar()).toBeFalse();
    });
  });

  describe('salvar', () => {
    function comValoresMinimosValidos(comp: AdminProdutoFormComponent) {
      comp.atualizarNome('Produto Teste');
      comp.alternarCategoria('geek', true);
      comp.imagens.set(['/a.webp']);
      comp.alternarTamanho('M', true);
      comp.alternarCor('Preto', true);
      comp.gerarVariantes();
    }

    it('não chama o serviço quando o formulário é inválido', () => {
      const { fixture } = configurar(null);

      fixture.componentInstance.salvar();

      expect(adminProdutoServiceSpy.criar).not.toHaveBeenCalled();
    });

    it('cria o produto (modo criação) e navega de volta pra listagem', () => {
      adminProdutoServiceSpy.criar.and.returnValue(of(criarProduto()));
      const { fixture, navigateSpy } = configurar(null);
      const comp = fixture.componentInstance;
      comValoresMinimosValidos(comp);

      comp.salvar();

      expect(adminProdutoServiceSpy.criar).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/admin/produtos']);
      expect(comp.sujo()).toBeFalse();
    });

    it('atualiza o produto (modo edição) em vez de criar', () => {
      adminProdutoServiceSpy.obterPorId.and.returnValue(of(criarProduto()));
      adminProdutoServiceSpy.atualizar.and.returnValue(of(criarProduto()));
      const { fixture } = configurar('prod-1');
      const comp = fixture.componentInstance;

      comp.salvar();

      expect(adminProdutoServiceSpy.atualizar).toHaveBeenCalled();
      expect(adminProdutoServiceSpy.criar).not.toHaveBeenCalled();
    });

    it('mostra mensagem específica quando o slug já existe (erro duplicate)', () => {
      adminProdutoServiceSpy.criar.and.returnValue(
        throwError(() => ({ message: 'duplicate key value' }))
      );
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comValoresMinimosValidos(comp);

      comp.salvar();

      expect(comp.erro()).toContain('Já existe um produto com esse identificador/slug');
      expect(comp.salvando()).toBeFalse();
    });

    it('mostra mensagem genérica pra outras falhas', () => {
      adminProdutoServiceSpy.criar.and.returnValue(throwError(() => new Error('erro qualquer')));
      const { fixture } = configurar(null);
      const comp = fixture.componentInstance;
      comValoresMinimosValidos(comp);

      comp.salvar();

      expect(comp.erro()).toBe('Não foi possível salvar o produto.');
    });

    it('dispara notificação de reposição pra variante que saiu de estoque 0 pra positivo', () => {
      const produtoComVarianteZerada = criarProduto({
        variantes: [
          {
            id: 'v1',
            produtoId: 'prod-1',
            sku: 'SKU-1',
            tamanho: 'M',
            cor: 'Preto',
            quantidadeEstoque: 0,
          },
        ],
      });
      adminProdutoServiceSpy.obterPorId.and.returnValue(of(produtoComVarianteZerada));
      adminProdutoServiceSpy.atualizar.and.returnValue(of(produtoComVarianteZerada));
      const { fixture } = configurar('prod-1');
      const comp = fixture.componentInstance;
      comp.atualizarVariante('v1', 'quantidadeEstoque', '10');

      comp.salvar();

      expect(notificarEstoqueServiceSpy.notificarReposicao).toHaveBeenCalledWith(
        'v1',
        'camiseta-batman'
      );
    });
  });
});
