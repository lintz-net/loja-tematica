import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PedidoService } from './pedido.service';
import { SupabaseRestService } from './supabase-rest.service';
import { SupabaseClienteService } from './supabase.client';
import { Pedido } from '../modelos/pedido.model';

function dadosPedidoBase(): Omit<Pedido, 'codigo' | 'criadoEm' | 'status'> {
  return {
    nomeCliente: 'Izac Lins',
    emailCliente: 'izac@example.com',
    telefoneCliente: '11999999999',
    documentoCliente: '12345678909',
    endereco: {
      endereco: 'Rua das Flores',
      numero: '100',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-100',
    },
    itens: [
      {
        produtoNome: 'Camiseta Batman',
        produtoSlug: 'camiseta-batman',
        imagem: '/foto.webp',
        tamanho: 'M',
        cor: 'Preto',
        quantidade: 1,
        precoUnitario: 49.9,
      },
    ],
    formaPagamento: 'pix',
    parcelas: 1,
    valorFrete: 10,
    valorTotal: 59.9,
  };
}

function linhaPedidoCrua(sobrescritas: Record<string, unknown> = {}) {
  return {
    codigo: 'VT-ABC123',
    criado_em: '2026-09-25T12:00:00.000Z',
    status: 'recebido',
    nome_cliente: 'Izac Lins',
    email_cliente: 'izac@example.com',
    telefone_cliente: '11999999999',
    documento_cliente: null,
    endereco: {
      endereco: 'Rua das Flores',
      numero: '100',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-100',
    },
    itens: [],
    forma_pagamento: 'pix',
    parcelas: 1,
    valor_frete: 10,
    valor_total: 59.9,
    frete_servico_id: null,
    frete_transportadora: null,
    frete_servico_nome: null,
    frete_prazo_dias: null,
    cupom_codigo: null,
    valor_desconto: null,
    ...sobrescritas,
  };
}

describe('PedidoService', () => {
  let service: PedidoService;
  let restSpy: jasmine.SpyObj<SupabaseRestService>;
  let fetchSpy: jasmine.Spy;
  let clienteFake: { from: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{
    select: jasmine.Spy;
    update: jasmine.Spy;
    eq: jasmine.Spy;
    order: jasmine.Spy;
    single: jasmine.Spy;
  }>;

  beforeEach(() => {
    restSpy = jasmine.createSpyObj('SupabaseRestService', ['insert', 'rpc', 'select']);

    tabelaFake = jasmine.createSpyObj('tabela', ['select', 'update', 'eq', 'order', 'single']);
    tabelaFake.select.and.returnValue(tabelaFake);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);
    tabelaFake.order.and.returnValue(tabelaFake);

    clienteFake = { from: jasmine.createSpy('from').and.returnValue(tabelaFake) };
    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake as never);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseRestService, useValue: restSpy },
        { provide: SupabaseClienteService, useValue: supabaseClienteSpy },
      ],
    });
    service = TestBed.inject(PedidoService);

    // criarPedido dispara o e-mail de confirmação via fetch puro (fire-and-forget) — espiona
    // o global pra não fazer chamada de rede de verdade nem falhar por CORS.
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('{}', { status: 200 }));
  });

  describe('criarPedido', () => {
    it('monta a linha em snake_case e insere via SupabaseRestService', (done) => {
      restSpy.insert.and.returnValue(of(undefined));

      service.criarPedido(dadosPedidoBase()).subscribe(() => {
        expect(restSpy.insert).toHaveBeenCalledTimes(1);
        const [tabela, linha] = restSpy.insert.calls.mostRecent().args;
        expect(tabela).toBe('pedidos');
        expect(linha).toEqual(
          jasmine.objectContaining({
            status: 'recebido',
            nome_cliente: 'Izac Lins',
            email_cliente: 'izac@example.com',
            documento_cliente: '12345678909',
            valor_total: 59.9,
          })
        );
        done();
      });
    });

    it('documentoCliente ausente vira null na linha (não undefined)', (done) => {
      restSpy.insert.and.returnValue(of(undefined));
      const dados = { ...dadosPedidoBase(), documentoCliente: undefined };

      service.criarPedido(dados).subscribe(() => {
        const [, linha] = restSpy.insert.calls.mostRecent().args as [string, Record<string, unknown>];
        expect(linha['documento_cliente']).toBeNull();
        done();
      });
    });

    it('gera um código no formato VT-XXXXXX e devolve o pedido com status recebido', (done) => {
      restSpy.insert.and.returnValue(of(undefined));

      service.criarPedido(dadosPedidoBase()).subscribe((pedido) => {
        expect(pedido.codigo).toMatch(/^VT-[A-Z0-9]+$/);
        expect(pedido.status).toBe('recebido');
        expect(pedido.criadoEm).toBeTruthy();
        expect(pedido.nomeCliente).toBe('Izac Lins');
        done();
      });
    });

    it('propaga o erro quando o insert falha, sem tentar mandar e-mail', (done) => {
      restSpy.insert.and.returnValue(throwError(() => new Error('insert falhou')));

      service.criarPedido(dadosPedidoBase()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('insert falhou');
          expect(fetchSpy).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('dispara o e-mail de confirmação (fire-and-forget) depois do insert', (done) => {
      restSpy.insert.and.returnValue(of(undefined));

      service.criarPedido(dadosPedidoBase()).subscribe((pedido) => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.calls.mostRecent().args;
        expect(url).toContain('/functions/v1/enviar-email-pedido');
        const corpo = JSON.parse((init as RequestInit).body as string);
        expect(corpo.codigo).toBe(pedido.codigo);
        expect(corpo.emailCliente).toBe('izac@example.com');
        done();
      });
    });

    it('não deixa a falha do e-mail vazar pro observable do pedido (fire-and-forget de verdade)', (done) => {
      restSpy.insert.and.returnValue(of(undefined));
      fetchSpy.and.rejectWith(new Error('rede caiu'));

      service.criarPedido(dadosPedidoBase()).subscribe({
        next: (pedido) => {
          expect(pedido.codigo).toBeTruthy();
          done();
        },
        error: () => done.fail('não deveria propagar erro do envio de e-mail'),
      });
    });
  });

  describe('criarPagamentoPix', () => {
    it('devolve os dados do Pix quando a Edge Function responde ok', (done) => {
      const resposta = { idPagamento: '123', qrCode: 'copia-e-cola', qrCodeBase64: 'base64==', expiraEm: '2026-01-01T00:00:00Z' };
      fetchSpy.and.resolveTo(new Response(JSON.stringify(resposta), { status: 200 }));

      service
        .criarPagamentoPix({
          codigoPedido: 'VT-ABC123',
          valorTotal: 59.9,
          emailCliente: 'izac@example.com',
          nomeCliente: 'Izac Lins',
        })
        .subscribe((r) => {
          expect(r).toEqual(resposta);
          const [url] = fetchSpy.calls.mostRecent().args;
          expect(url).toContain('/functions/v1/mercado-pago-criar-pagamento');
          done();
        });
    });

    it('erra quando a Edge Function responde status de erro', (done) => {
      fetchSpy.and.resolveTo(new Response('{"error":"falhou"}', { status: 502 }));

      service
        .criarPagamentoPix({
          codigoPedido: 'VT-ABC123',
          valorTotal: 59.9,
          emailCliente: 'izac@example.com',
          nomeCliente: 'Izac Lins',
        })
        .subscribe({
          error: (erro) => {
            expect(erro.message).toContain('502');
            done();
          },
        });
    });
  });

  describe('criarPagamentoCartao', () => {
    it('devolve status/idPagamento quando a Edge Function responde ok', (done) => {
      const resposta = { idPagamento: '456', status: 'approved', statusDetail: 'accredited' };
      fetchSpy.and.resolveTo(new Response(JSON.stringify(resposta), { status: 200 }));

      service
        .criarPagamentoCartao({
          codigoPedido: 'VT-ABC123',
          valorTotal: 59.9,
          emailCliente: 'izac@example.com',
          nomeCliente: 'Izac Lins',
          token: 'tok_123',
          paymentMethodId: 'master',
        })
        .subscribe((r) => {
          expect(r).toEqual(resposta);
          const [url, init] = fetchSpy.calls.mostRecent().args;
          expect(url).toContain('/functions/v1/mercado-pago-criar-pagamento-cartao');
          const corpo = JSON.parse((init as RequestInit).body as string);
          expect(corpo.token).toBe('tok_123');
          done();
        });
    });

    it('erra quando a Edge Function responde status de erro', (done) => {
      fetchSpy.and.resolveTo(new Response('{"error":"cartao recusado"}', { status: 502 }));

      service
        .criarPagamentoCartao({
          codigoPedido: 'VT-ABC123',
          valorTotal: 59.9,
          emailCliente: 'izac@example.com',
          nomeCliente: 'Izac Lins',
          token: 'tok_123',
          paymentMethodId: 'master',
        })
        .subscribe({
          error: (erro) => {
            expect(erro.message).toContain('502');
            done();
          },
        });
    });
  });

  describe('obterPorCodigo', () => {
    it('mapeia a linha (snake_case) pro Pedido (camelCase)', (done) => {
      restSpy.rpc.and.returnValue(of([linhaPedidoCrua()]));

      service.obterPorCodigo('VT-ABC123').subscribe((pedido) => {
        expect(restSpy.rpc).toHaveBeenCalledWith('obter_pedido_por_codigo', { p_codigo: 'VT-ABC123' });
        expect(pedido).toEqual(
          jasmine.objectContaining({
            codigo: 'VT-ABC123',
            nomeCliente: 'Izac Lins',
            emailCliente: 'izac@example.com',
            valorTotal: 59.9,
          })
        );
        done();
      });
    });

    it('campos nulos da linha viram undefined no Pedido (documentoCliente, frete, cupom...)', (done) => {
      restSpy.rpc.and.returnValue(of([linhaPedidoCrua()]));

      service.obterPorCodigo('VT-ABC123').subscribe((pedido) => {
        expect(pedido?.documentoCliente).toBeUndefined();
        expect(pedido?.freteServicoId).toBeUndefined();
        expect(pedido?.cupomCodigo).toBeUndefined();
        expect(pedido?.pixQrCode).toBeUndefined();
        done();
      });
    });

    it('devolve null quando a RPC não encontra o pedido', (done) => {
      restSpy.rpc.and.returnValue(of([]));

      service.obterPorCodigo('CODIGO-INEXISTENTE').subscribe((pedido) => {
        expect(pedido).toBeNull();
        done();
      });
    });
  });

  describe('listarTodos', () => {
    it('busca via cliente completo, ordenado por data (desc), e mapeia as linhas', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaPedidoCrua()], error: null }));

      service.listarTodos().subscribe((pedidos) => {
        expect(clienteFake.from).toHaveBeenCalledWith('pedidos');
        expect(pedidos).toEqual([jasmine.objectContaining({ codigo: 'VT-ABC123' })]);
        done();
      });
    });

    it('propaga o erro quando a listagem falha', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

      service.listarTodos().subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('listarMeusPedidos', () => {
    it('delega pra listarTodos (a RLS que filtra pro cliente logado)', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaPedidoCrua()], error: null }));

      service.listarMeusPedidos().subscribe((pedidos) => {
        expect(pedidos.length).toBe(1);
        done();
      });
    });
  });

  describe('atualizarStatus', () => {
    it('atualiza o status pelo código e devolve o pedido mapeado', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaPedidoCrua({ status: 'confirmado' }), error: null })
      );

      service.atualizarStatus('VT-ABC123', 'confirmado').subscribe((pedido) => {
        expect(tabelaFake.update).toHaveBeenCalledWith({ status: 'confirmado' });
        expect(tabelaFake.eq).toHaveBeenCalledWith('codigo', 'VT-ABC123');
        expect(pedido.status).toBe('confirmado');
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.atualizarStatus('VT-ABC123', 'confirmado').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
