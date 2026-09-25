import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EnvioService } from './envio.service';
import { SupabaseClienteService } from './supabase.client';
import { SupabaseRestService } from './supabase-rest.service';

function linhaEnvio(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'env-1',
    codigo_pedido: 'VT-ABC123',
    status_envio: 'aguardando_compra',
    url_etiqueta: null,
    codigo_rastreio: null,
    erro_compra_etiqueta: null,
    ...sobrescritas,
  };
}

describe('EnvioService', () => {
  let service: EnvioService;
  let restSpy: jasmine.SpyObj<SupabaseRestService>;
  let clienteFake: { from: jasmine.Spy; channel: jasmine.Spy; removeChannel: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{ select: jasmine.Spy }>;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    restSpy = jasmine.createSpyObj('SupabaseRestService', ['rpc']);

    tabelaFake = jasmine.createSpyObj('tabela', ['select']);
    tabelaFake.select.and.returnValue(Promise.resolve({ data: [linhaEnvio()], error: null }));

    clienteFake = {
      from: jasmine.createSpy('from').and.returnValue(tabelaFake),
      channel: jasmine.createSpy('channel'),
      removeChannel: jasmine.createSpy('removeChannel'),
    };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake as never);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseRestService, useValue: restSpy },
        { provide: SupabaseClienteService, useValue: supabaseClienteSpy },
      ],
    });
    service = TestBed.inject(EnvioService);
    fetchSpy = spyOn(window, 'fetch');
  });

  describe('obterPorCodigoPedido', () => {
    it('mapeia a linha via RPC pública', (done) => {
      restSpy.rpc.and.returnValue(of([linhaEnvio()]));

      service.obterPorCodigoPedido('VT-ABC123').subscribe((envio) => {
        expect(restSpy.rpc).toHaveBeenCalledWith('obter_envio_por_codigo_pedido', {
          p_codigo_pedido: 'VT-ABC123',
        });
        expect(envio).toEqual(jasmine.objectContaining({ id: 'env-1', codigoPedido: 'VT-ABC123' }));
        done();
      });
    });

    it('devolve null quando não encontra envio', (done) => {
      restSpy.rpc.and.returnValue(of([]));

      service.obterPorCodigoPedido('VT-INEXISTENTE').subscribe((envio) => {
        expect(envio).toBeNull();
        done();
      });
    });
  });

  describe('listarTodos', () => {
    it('devolve um Map indexado pelo código do pedido', (done) => {
      service.listarTodos().subscribe((mapa) => {
        expect(clienteFake.from).toHaveBeenCalledWith('envios');
        expect(mapa.get('VT-ABC123')).toEqual(
          jasmine.objectContaining({ id: 'env-1', statusEnvio: 'aguardando_compra' })
        );
        done();
      });
    });

    it('propaga o erro quando a listagem falha', (done) => {
      tabelaFake.select.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

      service.listarTodos().subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('escutarMudancas', () => {
    it('inscreve num canal Realtime filtrado pelo código do pedido e devolve função de cancelar', () => {
      const canalFake = jasmine.createSpyObj('canal', ['on', 'subscribe']);
      canalFake.on.and.returnValue(canalFake);
      canalFake.subscribe.and.returnValue(canalFake);
      clienteFake.channel.and.returnValue(canalFake);

      const cancelar = service.escutarMudancas('VT-ABC123', () => {});

      expect(clienteFake.channel).toHaveBeenCalledWith('envio-VT-ABC123');
      expect(canalFake.on).toHaveBeenCalled();

      cancelar();

      expect(clienteFake.removeChannel).toHaveBeenCalledWith(canalFake);
    });

    it('mapeia o payload recebido e chama o callback quando o evento Realtime dispara', () => {
      const canalFake = jasmine.createSpyObj('canal', ['on', 'subscribe']);
      canalFake.on.and.returnValue(canalFake);
      canalFake.subscribe.and.returnValue(canalFake);
      clienteFake.channel.and.returnValue(canalFake);
      const aoMudar = jasmine.createSpy('aoMudar');

      service.escutarMudancas('VT-ABC123', aoMudar);
      const [, , handler] = canalFake.on.calls.mostRecent().args;
      handler({ new: linhaEnvio({ status_envio: 'gerado' }) });

      expect(aoMudar).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'env-1', statusEnvio: 'gerado' })
      );
    });
  });

  describe('comprarEtiqueta', () => {
    it('devolve ok=true quando a Edge Function responde 2xx', async () => {
      fetchSpy.and.resolveTo(new Response('{}', { status: 200 }));

      const resultado = await service.comprarEtiqueta('VT-ABC123', '12345678909');

      expect(resultado).toEqual({ ok: true });
      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toContain('/functions/v1/melhor-envio-comprar-etiqueta');
      const corpo = JSON.parse((init as RequestInit).body as string);
      expect(corpo.codigoPedido).toBe('VT-ABC123');
    });

    it('devolve ok=false com a mensagem de erro quando a Edge Function falha', async () => {
      fetchSpy.and.resolveTo(
        new Response(JSON.stringify({ error: 'CEP inválido' }), { status: 400 })
      );

      const resultado = await service.comprarEtiqueta('VT-ABC123');

      expect(resultado).toEqual({ ok: false, error: 'CEP inválido' });
    });

    it('usa mensagem padrão quando a resposta de erro não vem em JSON', async () => {
      fetchSpy.and.resolveTo(new Response('não é json', { status: 500 }));

      const resultado = await service.comprarEtiqueta('VT-ABC123');

      expect(resultado).toEqual({ ok: false, error: 'Falha ao comprar etiqueta.' });
    });
  });
});
