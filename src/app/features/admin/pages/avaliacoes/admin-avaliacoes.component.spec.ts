import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminAvaliacoesComponent } from './admin-avaliacoes.component';
import { AdminAvaliacaoService } from '../../../../core/servicos/admin-avaliacao.service';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { Avaliacao } from '../../../../core/modelos/avaliacao.model';
import { Produto } from '../../../../core/modelos/produto.model';

function criarAvaliacao(sobrescritas: Partial<Avaliacao> = {}): Avaliacao {
  return {
    id: 'aval-1',
    nomeCliente: 'Maria',
    nota: 5,
    criadoEm: '2026-01-01T00:00:00.000Z',
    status: 'aprovada',
    ...sobrescritas,
  };
}

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Batman',
    slug: 'camiseta-batman',
    descricao: '',
    precoBase: 50,
    categorias: [],
    imagens: [],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

describe('AdminAvaliacoesComponent', () => {
  let adminAvaliacaoServiceSpy: jasmine.SpyObj<AdminAvaliacaoService>;
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;

  function configurar(): ComponentFixture<AdminAvaliacoesComponent> {
    TestBed.configureTestingModule({
      imports: [AdminAvaliacoesComponent],
      providers: [
        { provide: AdminAvaliacaoService, useValue: adminAvaliacaoServiceSpy },
        { provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy },
      ],
    });
    const fixture = TestBed.createComponent(AdminAvaliacoesComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    adminAvaliacaoServiceSpy = jasmine.createSpyObj('AdminAvaliacaoService', [
      'listarTodas',
      'criar',
      'remover',
      'atualizarStatus',
    ]);
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', ['obterProdutos']);
    adminAvaliacaoServiceSpy.listarTodas.and.returnValue(of([criarAvaliacao()]));
    catalogoRepositorioSpy.obterProdutos.and.returnValue(of([criarProduto()]));
  });

  it('carrega avaliações e produtos', () => {
    const fixture = configurar();

    expect(fixture.componentInstance.carregando()).toBeFalse();
    expect(fixture.componentInstance.avaliacoes()).toEqual([criarAvaliacao()]);
    expect(fixture.componentInstance.produtos()).toEqual([criarProduto()]);
  });

  it('mostra erro quando a listagem de avaliações falha', () => {
    adminAvaliacaoServiceSpy.listarTodas.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar as avaliações');
  });

  describe('nomeDoProduto', () => {
    it('devolve travessão quando não há produtoId', () => {
      const fixture = configurar();
      expect(fixture.componentInstance.nomeDoProduto(null)).toBe('—');
      expect(fixture.componentInstance.nomeDoProduto(undefined)).toBe('—');
    });

    it('devolve o nome do produto quando encontrado', () => {
      const fixture = configurar();
      expect(fixture.componentInstance.nomeDoProduto('prod-1')).toBe('Camiseta Batman');
    });

    it('devolve travessão quando o produto não é encontrado', () => {
      const fixture = configurar();
      expect(fixture.componentInstance.nomeDoProduto('inexistente')).toBe('—');
    });
  });

  describe('atualizarNovaNota', () => {
    it('converte o valor pra número, com fallback 5 se inválido', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovaNota('3');
      expect(comp.novaNota()).toBe(3);

      comp.atualizarNovaNota('abc');
      expect(comp.novaNota()).toBe(5);
    });
  });

  describe('podeCriar', () => {
    it('exige nome do cliente preenchido', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      expect(comp.podeCriar()).toBeFalse();

      comp.novoNomeCliente.set('Maria');
      expect(comp.podeCriar()).toBeTrue();
    });
  });

  describe('criarAvaliacao', () => {
    it('cria a avaliação, insere no topo da lista e limpa o formulário', () => {
      const nova = criarAvaliacao({ id: 'aval-2', nomeCliente: 'João' });
      adminAvaliacaoServiceSpy.criar.and.returnValue(of(nova));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novoNomeCliente.set('João');

      comp.criarAvaliacao();

      expect(adminAvaliacaoServiceSpy.criar).toHaveBeenCalledWith(
        jasmine.objectContaining({ nomeCliente: 'João', nota: 5 })
      );
      expect(comp.avaliacoes()[0]).toEqual(nova);
      expect(comp.novoNomeCliente()).toBe('');
      expect(comp.salvando()).toBeFalse();
    });

    it('não chama o serviço quando o nome do cliente está vazio', () => {
      const fixture = configurar();
      fixture.componentInstance.criarAvaliacao();

      expect(adminAvaliacaoServiceSpy.criar).not.toHaveBeenCalled();
    });

    it('mostra erro quando a criação falha', () => {
      adminAvaliacaoServiceSpy.criar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novoNomeCliente.set('João');

      comp.criarAvaliacao();

      expect(comp.erro()).toContain('Não foi possível criar a avaliação');
      expect(comp.salvando()).toBeFalse();
    });
  });

  describe('avaliacoesFiltradas', () => {
    it('filtra por "pendente" por padrão', () => {
      adminAvaliacaoServiceSpy.listarTodas.and.returnValue(
        of([criarAvaliacao({ id: 'a1', status: 'pendente' }), criarAvaliacao({ id: 'a2', status: 'aprovada' })])
      );
      const fixture = configurar();

      expect(fixture.componentInstance.filtroStatus()).toBe('pendente');
      expect(fixture.componentInstance.avaliacoesFiltradas().map((a) => a.id)).toEqual(['a1']);
    });

    it('"todas" mostra tudo, sem filtrar', () => {
      adminAvaliacaoServiceSpy.listarTodas.and.returnValue(
        of([criarAvaliacao({ id: 'a1', status: 'pendente' }), criarAvaliacao({ id: 'a2', status: 'rejeitada' })])
      );
      const fixture = configurar();
      fixture.componentInstance.filtroStatus.set('todas');

      expect(fixture.componentInstance.avaliacoesFiltradas().map((a) => a.id)).toEqual(['a1', 'a2']);
    });

    it('quantidadePendentes conta só as pendentes, independente do filtro atual', () => {
      adminAvaliacaoServiceSpy.listarTodas.and.returnValue(
        of([
          criarAvaliacao({ id: 'a1', status: 'pendente' }),
          criarAvaliacao({ id: 'a2', status: 'pendente' }),
          criarAvaliacao({ id: 'a3', status: 'aprovada' }),
        ])
      );
      const fixture = configurar();

      expect(fixture.componentInstance.quantidadePendentes()).toBe(2);
    });
  });

  describe('moderar', () => {
    it('aprova a avaliação e atualiza a lista', () => {
      const pendente = criarAvaliacao({ id: 'a1', status: 'pendente' });
      adminAvaliacaoServiceSpy.listarTodas.and.returnValue(of([pendente]));
      adminAvaliacaoServiceSpy.atualizarStatus.and.returnValue(of({ ...pendente, status: 'aprovada' }));
      const fixture = configurar();

      fixture.componentInstance.moderar(pendente, 'aprovada');

      expect(adminAvaliacaoServiceSpy.atualizarStatus).toHaveBeenCalledWith('a1', 'aprovada');
      expect(fixture.componentInstance.avaliacoes()[0].status).toBe('aprovada');
      expect(fixture.componentInstance.idModerando()).toBeNull();
    });

    it('mostra erro quando a moderação falha', () => {
      const pendente = criarAvaliacao({ id: 'a1', status: 'pendente' });
      adminAvaliacaoServiceSpy.listarTodas.and.returnValue(of([pendente]));
      adminAvaliacaoServiceSpy.atualizarStatus.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.moderar(pendente, 'rejeitada');

      expect(fixture.componentInstance.erro()).toContain('Não foi possível atualizar a avaliação');
      expect(fixture.componentInstance.idModerando()).toBeNull();
    });
  });

  describe('remover', () => {
    it('não remove quando o admin cancela a confirmação', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = configurar();

      fixture.componentInstance.remover(criarAvaliacao());

      expect(adminAvaliacaoServiceSpy.remover).not.toHaveBeenCalled();
    });

    it('remove a avaliação da lista quando confirmado e a remoção dá certo', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminAvaliacaoServiceSpy.remover.and.returnValue(of(undefined));
      const fixture = configurar();

      fixture.componentInstance.remover(criarAvaliacao());

      expect(fixture.componentInstance.avaliacoes()).toEqual([]);
      expect(fixture.componentInstance.idExcluindo()).toBeNull();
    });

    it('mostra erro quando a remoção falha', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminAvaliacaoServiceSpy.remover.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.remover(criarAvaliacao());

      expect(fixture.componentInstance.erro()).toContain('Não foi possível excluir a avaliação');
    });
  });
});
