import { TestBed } from '@angular/core/testing';
import { AdminSolicitacaoTrocaService } from './admin-solicitacao-troca.service';
import { SupabaseClienteService } from './supabase.client';

function linhaSolicitacao(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'sol-1',
    pedido_codigo: 'VT-ABC123',
    email_cliente: 'cliente@example.com',
    tipo: 'troca',
    itens: [{ produtoNome: 'Camiseta X', produtoSlug: 'camiseta-x', tamanho: 'M', cor: 'Preto', quantidade: 1 }],
    motivo: 'Tamanho errado',
    observacoes: null,
    status: 'pendente',
    resposta_admin: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('AdminSolicitacaoTrocaService', () => {
  let service: AdminSolicitacaoTrocaService;
  let clienteFake: { from: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{
    select: jasmine.Spy;
    update: jasmine.Spy;
    eq: jasmine.Spy;
    order: jasmine.Spy;
    single: jasmine.Spy;
  }>;

  beforeEach(() => {
    tabelaFake = jasmine.createSpyObj('tabela', ['select', 'update', 'eq', 'order', 'single']);
    tabelaFake.select.and.returnValue(tabelaFake);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);
    tabelaFake.order.and.returnValue(tabelaFake);

    clienteFake = { from: jasmine.createSpy('from').and.returnValue(tabelaFake) };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseClienteService, useValue: supabaseClienteSpy }],
    });
    service = TestBed.inject(AdminSolicitacaoTrocaService);
  });

  describe('listarTodas', () => {
    it('mapeia as linhas ordenadas por data (desc)', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaSolicitacao()], error: null }));

      service.listarTodas().subscribe((solicitacoes) => {
        expect(clienteFake.from).toHaveBeenCalledWith('solicitacoes_troca');
        expect(solicitacoes).toEqual([
          jasmine.objectContaining({ id: 'sol-1', pedidoCodigo: 'VT-ABC123', status: 'pendente' }),
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

  describe('atualizarStatus', () => {
    it('atualiza status e resposta pelo id', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaSolicitacao({ status: 'aprovada', resposta_admin: 'Ok' }), error: null })
      );

      service.atualizarStatus('sol-1', 'aprovada', 'Ok').subscribe((solicitacao) => {
        expect(tabelaFake.update).toHaveBeenCalledWith(
          jasmine.objectContaining({ status: 'aprovada', resposta_admin: 'Ok' })
        );
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'sol-1');
        expect(solicitacao.status).toBe('aprovada');
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

      service.atualizarStatus('sol-1', 'recusada').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
