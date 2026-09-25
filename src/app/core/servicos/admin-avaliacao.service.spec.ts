import { TestBed } from '@angular/core/testing';
import { AdminAvaliacaoService } from './admin-avaliacao.service';
import { SupabaseClienteService } from './supabase.client';
import { Avaliacao } from '../modelos/avaliacao.model';

function linhaAvaliacao(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'aval-1',
    produto_id: null,
    nome_cliente: 'Maria',
    nota: 5,
    comentario: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

function dadosAvaliacao(sobrescritas: Partial<Omit<Avaliacao, 'id'>> = {}): Omit<Avaliacao, 'id'> {
  return {
    nomeCliente: 'Maria',
    nota: 5,
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('AdminAvaliacaoService', () => {
  let service: AdminAvaliacaoService;
  let clienteFake: { from: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{
    select: jasmine.Spy;
    insert: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
    eq: jasmine.Spy;
    order: jasmine.Spy;
    single: jasmine.Spy;
  }>;

  beforeEach(() => {
    tabelaFake = jasmine.createSpyObj('tabela', [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'order',
      'single',
    ]);
    tabelaFake.select.and.returnValue(tabelaFake);
    tabelaFake.insert.and.returnValue(tabelaFake);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.delete.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);
    tabelaFake.order.and.returnValue(tabelaFake);

    clienteFake = { from: jasmine.createSpy('from').and.returnValue(tabelaFake) };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseClienteService, useValue: supabaseClienteSpy }],
    });
    service = TestBed.inject(AdminAvaliacaoService);
  });

  describe('listarTodas', () => {
    it('mapeia as linhas ordenadas por data (desc)', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaAvaliacao()], error: null }));

      service.listarTodas().subscribe((avaliacoes) => {
        expect(clienteFake.from).toHaveBeenCalledWith('avaliacoes');
        expect(avaliacoes).toEqual([
          jasmine.objectContaining({ id: 'aval-1', nomeCliente: 'Maria', produtoId: undefined }),
        ]);
        done();
      });
    });

    it('propaga o erro quando a listagem falha', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

      service.listarTodas().subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('criar', () => {
    it('insere a linha em snake_case, com produto_id null quando ausente', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaAvaliacao(), error: null }));

      service.criar(dadosAvaliacao()).subscribe((avaliacao) => {
        expect(tabelaFake.insert).toHaveBeenCalledWith(
          jasmine.objectContaining({ nome_cliente: 'Maria', produto_id: null })
        );
        expect(avaliacao.nota).toBe(5);
        done();
      });
    });

    it('propaga o erro quando o insert falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.criar(dadosAvaliacao()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('atualizar', () => {
    it('atualiza pelo id', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaAvaliacao({ nota: 4 }), error: null })
      );

      service.atualizar('aval-1', dadosAvaliacao({ nota: 4 })).subscribe((avaliacao) => {
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'aval-1');
        expect(avaliacao.nota).toBe(4);
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.atualizar('aval-1', dadosAvaliacao()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('remover', () => {
    it('remove pelo id', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: null }));

      service.remover('aval-1').subscribe(() => {
        expect(tabelaFake.delete).toHaveBeenCalled();
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'aval-1');
        done();
      });
    });

    it('propaga o erro quando a remoção falha', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: new Error('falhou') }));

      service.remover('aval-1').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
