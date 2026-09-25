import { TestBed } from '@angular/core/testing';
import { AdminCategoriaService } from './admin-categoria.service';
import { SupabaseClienteService } from './supabase.client';
import { Categoria } from '../modelos/categoria.model';

function linhaCategoria(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'geek',
    nome: 'Geek',
    slug: 'geek',
    cor_tema: '#7b2ff7',
    descricao_curta: 'Games e HQs',
    icone: '🕹️',
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

describe('AdminCategoriaService', () => {
  let service: AdminCategoriaService;
  let clienteFake: { from: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{
    insert: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
    eq: jasmine.Spy;
    select: jasmine.Spy;
    single: jasmine.Spy;
  }>;

  beforeEach(() => {
    tabelaFake = jasmine.createSpyObj('tabela', [
      'insert',
      'update',
      'delete',
      'eq',
      'select',
      'single',
    ]);
    tabelaFake.insert.and.returnValue(tabelaFake);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.delete.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);
    tabelaFake.select.and.returnValue(tabelaFake);

    clienteFake = { from: jasmine.createSpy('from').and.returnValue(tabelaFake) };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseClienteService, useValue: supabaseClienteSpy }],
    });
    service = TestBed.inject(AdminCategoriaService);
  });

  describe('criar', () => {
    it('insere a categoria (id explícito) em snake_case', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaCategoria(), error: null }));

      service.criar(criarCategoria()).subscribe((categoria) => {
        expect(clienteFake.from).toHaveBeenCalledWith('categorias');
        expect(tabelaFake.insert).toHaveBeenCalledWith(
          jasmine.objectContaining({ id: 'geek', cor_tema: '#7b2ff7' })
        );
        expect(categoria.nome).toBe('Geek');
        done();
      });
    });

    it('propaga o erro quando o insert falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('duplicate key') })
      );

      service.criar(criarCategoria()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('duplicate key');
          done();
        },
      });
    });
  });

  describe('atualizar', () => {
    it('atualiza pelo id', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaCategoria({ nome: 'Geek & Nerd' }), error: null })
      );

      service.atualizar(criarCategoria({ nome: 'Geek & Nerd' })).subscribe((categoria) => {
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'geek');
        expect(categoria.nome).toBe('Geek & Nerd');
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.atualizar(criarCategoria()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('excluir', () => {
    it('exclui pelo id', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: null }));

      service.excluir('geek').subscribe(() => {
        expect(tabelaFake.delete).toHaveBeenCalled();
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'geek');
        done();
      });
    });

    it('propaga o erro quando a exclusão falha', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: new Error('falhou') }));

      service.excluir('geek').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
