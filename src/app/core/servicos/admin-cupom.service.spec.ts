import { TestBed } from '@angular/core/testing';
import { AdminCupomService } from './admin-cupom.service';
import { SupabaseClienteService } from './supabase.client';

function linhaCupom(sobrescritas: Record<string, unknown> = {}) {
  return {
    codigo: 'PROMO10',
    tipo_desconto: 'percentual',
    valor_desconto: 10,
    expira_em: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('AdminCupomService', () => {
  let service: AdminCupomService;
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
    service = TestBed.inject(AdminCupomService);
  });

  describe('listarTodos', () => {
    it('mapeia as linhas ordenadas por data (desc)', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaCupom()], error: null }));

      service.listarTodos().subscribe((cupons) => {
        expect(clienteFake.from).toHaveBeenCalledWith('cupons');
        expect(cupons).toEqual([
          jasmine.objectContaining({ codigo: 'PROMO10', tipoDesconto: 'percentual' }),
        ]);
        done();
      });
    });
  });

  describe('criar', () => {
    it('normaliza o código pra maiúsculas e insere em snake_case', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaCupom(), error: null }));

      service
        .criar({ codigo: 'promo10', tipoDesconto: 'percentual', valorDesconto: 10 })
        .subscribe((cupom) => {
          expect(tabelaFake.insert).toHaveBeenCalledWith(
            jasmine.objectContaining({ codigo: 'PROMO10', valor_desconto: 10, expira_em: null })
          );
          expect(cupom.codigo).toBe('PROMO10');
          done();
        });
    });

    it('propaga o erro quando o insert falha (ex.: código duplicado)', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('duplicate key') })
      );

      service
        .criar({ codigo: 'PROMO10', tipoDesconto: 'percentual', valorDesconto: 10 })
        .subscribe({
          error: (erro) => {
            expect(erro.message).toBe('duplicate key');
            done();
          },
        });
    });
  });

  describe('alternarAtivo', () => {
    it('atualiza o campo ativo pelo código', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaCupom({ ativo: false }), error: null })
      );

      service.alternarAtivo('PROMO10', false).subscribe((cupom) => {
        expect(tabelaFake.update).toHaveBeenCalledWith({ ativo: false });
        expect(tabelaFake.eq).toHaveBeenCalledWith('codigo', 'PROMO10');
        expect(cupom.ativo).toBeFalse();
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.alternarAtivo('PROMO10', false).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('excluir', () => {
    it('exclui pelo código', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: null }));

      service.excluir('PROMO10').subscribe(() => {
        expect(tabelaFake.delete).toHaveBeenCalled();
        expect(tabelaFake.eq).toHaveBeenCalledWith('codigo', 'PROMO10');
        done();
      });
    });

    it('propaga o erro quando a exclusão falha', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: new Error('falhou') }));

      service.excluir('PROMO10').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
