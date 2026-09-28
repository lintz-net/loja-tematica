import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SolicitacaoTrocaService } from './solicitacao-troca.service';
import { SupabaseClienteService } from './supabase.client';
import { ConfiguracaoLojaService } from './configuracao-loja.service';
import { ConfiguracaoLoja } from '../modelos/configuracao-loja.model';

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

function configuracaoBase(): ConfiguracaoLoja {
  return {
    nomeLoja: 'Vista Nostálgica',
    descricaoPadrao: '',
    emailContato: 'loja@example.com',
    whatsappNumero: '',
    whatsappMensagem: '',
    cidadesFreteGratis: [],
    mensagensBarraAnuncio: [],
  };
}

describe('SolicitacaoTrocaService', () => {
  let service: SolicitacaoTrocaService;
  let clienteFake: { from: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{ insert: jasmine.Spy; select: jasmine.Spy; order: jasmine.Spy; single: jasmine.Spy }>;
  let fetchSpy: jasmine.Spy;
  let configuracaoSignal: ReturnType<typeof signal<ConfiguracaoLoja | null>>;

  beforeEach(() => {
    tabelaFake = jasmine.createSpyObj('tabela', ['insert', 'select', 'order', 'single']);
    tabelaFake.insert.and.returnValue(tabelaFake);
    tabelaFake.select.and.returnValue(tabelaFake);
    tabelaFake.order.and.returnValue(tabelaFake);

    clienteFake = { from: jasmine.createSpy('from').and.returnValue(tabelaFake) };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake);

    configuracaoSignal = signal<ConfiguracaoLoja | null>(configuracaoBase());

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseClienteService, useValue: supabaseClienteSpy },
        { provide: ConfiguracaoLojaService, useValue: { configuracao: configuracaoSignal } },
      ],
    });
    service = TestBed.inject(SolicitacaoTrocaService);
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('{}', { status: 200 }));
  });

  describe('criar', () => {
    it('insere a linha em snake_case e notifica a loja por e-mail (fire-and-forget)', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaSolicitacao(), error: null }));

      service
        .criar({
          pedidoCodigo: 'VT-ABC123',
          emailCliente: 'cliente@example.com',
          nomeCliente: 'Izac Lins',
          tipo: 'troca',
          itens: [{ produtoNome: 'Camiseta X', produtoSlug: 'camiseta-x', tamanho: 'M', cor: 'Preto', quantidade: 1 }],
          motivo: 'Tamanho errado',
        })
        .subscribe((solicitacao) => {
          expect(clienteFake.from).toHaveBeenCalledWith('solicitacoes_troca');
          expect(tabelaFake.insert).toHaveBeenCalledWith(
            jasmine.objectContaining({ pedido_codigo: 'VT-ABC123', tipo: 'troca' })
          );
          expect(solicitacao.id).toBe('sol-1');

          expect(fetchSpy).toHaveBeenCalledTimes(1);
          const [url, init] = fetchSpy.calls.mostRecent().args;
          expect(url).toContain('enviar-email-solicitacao-troca');
          const corpo = JSON.parse((init as RequestInit).body as string);
          expect(corpo.emailLoja).toBe('loja@example.com');
          expect(corpo.pedidoCodigo).toBe('VT-ABC123');
          done();
        });
    });

    it('propaga o erro quando o insert falha, sem notificar por e-mail', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

      service
        .criar({
          pedidoCodigo: 'VT-ABC123',
          emailCliente: 'cliente@example.com',
          nomeCliente: 'Izac Lins',
          tipo: 'devolucao',
          itens: [],
          motivo: 'Defeito',
        })
        .subscribe({
          error: (erro) => {
            expect(erro.message).toBe('falhou');
            expect(fetchSpy).not.toHaveBeenCalled();
            done();
          },
        });
    });

    it('não quebra quando a loja ainda não tem e-mail de contato configurado', (done) => {
      configuracaoSignal.set(null);
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaSolicitacao(), error: null }));

      service
        .criar({
          pedidoCodigo: 'VT-ABC123',
          emailCliente: 'cliente@example.com',
          nomeCliente: 'Izac Lins',
          tipo: 'troca',
          itens: [],
          motivo: 'Tamanho errado',
        })
        .subscribe(() => {
          expect(fetchSpy).not.toHaveBeenCalled();
          done();
        });
    });
  });

  describe('listarMinhas', () => {
    it('mapeia as linhas ordenadas por data (desc)', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaSolicitacao()], error: null }));

      service.listarMinhas().subscribe((solicitacoes) => {
        expect(solicitacoes).toEqual([
          jasmine.objectContaining({ id: 'sol-1', status: 'pendente' }),
        ]);
        done();
      });
    });
  });
});
