import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { PedidoComponent } from './pedido.component';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { Envio, EnvioService } from '../../../../core/servicos/envio.service';
import { Pedido } from '../../../../core/modelos/pedido.model';

function criarPedido(sobrescritas: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'ABC123',
    criadoEm: '2026-09-24T12:00:00.000Z',
    status: 'recebido',
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
        imagem: '/imagens/produtos/camiseta-batman/foto_01.webp',
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
    statusPagamento: 'pendente',
    ...sobrescritas,
  };
}

describe('PedidoComponent', () => {
  let pedidoServiceSpy: jasmine.SpyObj<PedidoService>;
  let envioServiceSpy: jasmine.SpyObj<EnvioService>;

  let paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function configurar(options: {
    codigo?: string | null;
    plataforma?: 'browser' | 'server';
  } = {}): ComponentFixture<PedidoComponent> {
    const { codigo = 'ABC123', plataforma = 'browser' } = options;
    paramMapSubject = new BehaviorSubject(convertToParamMap(codigo === null ? {} : { codigo }));

    TestBed.configureTestingModule({
      imports: [PedidoComponent],
      providers: [
        provideRouter([]),
        { provide: PedidoService, useValue: pedidoServiceSpy },
        { provide: EnvioService, useValue: envioServiceSpy },
        { provide: PLATFORM_ID, useValue: plataforma },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMapSubject },
        },
      ],
    });

    return TestBed.createComponent(PedidoComponent);
  }

  beforeEach(() => {
    pedidoServiceSpy = jasmine.createSpyObj('PedidoService', ['obterPorCodigo']);
    envioServiceSpy = jasmine.createSpyObj('EnvioService', [
      'obterPorCodigoPedido',
      'escutarMudancas',
    ]);
    envioServiceSpy.obterPorCodigoPedido.and.returnValue(of(null));
    envioServiceSpy.escutarMudancas.and.returnValue(() => {});
  });

  it('carrega o pedido pelo código da rota e sai de "carregando"', () => {
    const pedido = criarPedido();
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(pedido));

    const fixture = configurar();
    fixture.detectChanges();

    expect(pedidoServiceSpy.obterPorCodigo).toHaveBeenCalledWith('ABC123');
    expect(fixture.componentInstance.pedido()).toEqual(pedido);
    expect(fixture.componentInstance.carregando()).toBeFalse();
    expect(fixture.componentInstance.naoEncontrado()).toBeFalse();
  });

  it('marca naoEncontrado quando o serviço devolve null', () => {
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(null));

    const fixture = configurar();
    fixture.detectChanges();

    expect(fixture.componentInstance.naoEncontrado()).toBeTrue();
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });

  it('marca naoEncontrado quando o serviço falha', () => {
    pedidoServiceSpy.obterPorCodigo.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();
    fixture.detectChanges();

    expect(fixture.componentInstance.naoEncontrado()).toBeTrue();
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });

  it('usa código vazio quando a rota não tem o parâmetro (não deveria acontecer, mas não quebra)', () => {
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(null));

    const fixture = configurar({ codigo: null });
    fixture.detectChanges();

    expect(pedidoServiceSpy.obterPorCodigo).toHaveBeenCalledWith('');
  });

  it('recarrega o pedido quando o código da rota muda sem recriar o componente (paramMap reativo)', () => {
    const pedidoA = criarPedido({ codigo: 'ABC123' });
    const pedidoB = criarPedido({ codigo: 'XYZ789' });
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(pedidoA));

    const fixture = configurar({ codigo: 'ABC123' });
    fixture.detectChanges();

    expect(fixture.componentInstance.pedido()?.codigo).toBe('ABC123');

    // Mesma instância do componente (Router reaproveitando ao navegar entre /pedido/:codigo) —
    // só o paramMap muda, sem passar de novo pelo construtor.
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(pedidoB));
    paramMapSubject.next(convertToParamMap({ codigo: 'XYZ789' }));
    fixture.detectChanges();

    expect(pedidoServiceSpy.obterPorCodigo).toHaveBeenCalledWith('XYZ789');
    expect(fixture.componentInstance.pedido()?.codigo).toBe('XYZ789');
  });

  it('cancela a escuta Realtime anterior antes de assinar a do novo código', () => {
    const cancelarA = jasmine.createSpy('cancelarA');
    const cancelarB = jasmine.createSpy('cancelarB');
    envioServiceSpy.escutarMudancas.and.returnValues(cancelarA, cancelarB);
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(criarPedido({ codigo: 'ABC123' })));

    const fixture = configurar({ codigo: 'ABC123', plataforma: 'browser' });
    fixture.detectChanges();

    paramMapSubject.next(convertToParamMap({ codigo: 'XYZ789' }));
    fixture.detectChanges();

    expect(cancelarA).toHaveBeenCalled();
    expect(envioServiceSpy.escutarMudancas).toHaveBeenCalledWith('XYZ789', jasmine.any(Function));
  });

  it('assina o realtime de envio só no browser e atualiza o signal quando o canal dispara', () => {
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(criarPedido()));

    const fixture = configurar({ plataforma: 'browser' });
    fixture.detectChanges();

    expect(envioServiceSpy.escutarMudancas).toHaveBeenCalledWith('ABC123', jasmine.any(Function));

    const aoMudar = envioServiceSpy.escutarMudancas.calls.mostRecent().args[1] as (
      envio: Envio
    ) => void;
    const envioAtualizado: Envio = {
      id: 'env-1',
      codigoPedido: 'ABC123',
      statusEnvio: 'postado',
      urlEtiqueta: null,
      codigoRastreio: 'BR123456789',
      erroCompraEtiqueta: null,
      atualizadoEm: '2026-09-27T12:00:00.000Z',
    };
    aoMudar(envioAtualizado);

    expect(fixture.componentInstance.envio()).toEqual(envioAtualizado);
  });

  it('não assina o realtime de envio durante SSR', () => {
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(criarPedido()));

    const fixture = configurar({ plataforma: 'server' });
    fixture.detectChanges();

    expect(envioServiceSpy.escutarMudancas).not.toHaveBeenCalled();
  });

  it('indiceEtapaAtual/indiceEtapaEnvio devolvem a posição certa', () => {
    pedidoServiceSpy.obterPorCodigo.and.returnValue(of(criarPedido()));
    const fixture = configurar();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.indiceEtapaAtual('confirmado')).toBe(1);
    expect(comp.indiceEtapaEnvio('gerado')).toBe(2);
  });

  describe('podeRetomarPagamento', () => {
    const casos: Array<[string, Partial<Pedido> | null, boolean]> = [
      ['pix pendente', { formaPagamento: 'pix', statusPagamento: 'pendente' }, true],
      ['pix recusado', { formaPagamento: 'pix', statusPagamento: 'recusado' }, true],
      ['pix aprovado', { formaPagamento: 'pix', statusPagamento: 'aprovado' }, false],
      ['pix cancelado', { formaPagamento: 'pix', statusPagamento: 'cancelado' }, false],
      ['pix expirado', { formaPagamento: 'pix', statusPagamento: 'expirado' }, false],
      ['pix sem statusPagamento (pedido antigo)', { formaPagamento: 'pix', statusPagamento: undefined }, false],
      ['cartão pendente', { formaPagamento: 'cartao', statusPagamento: 'pendente' }, true],
      ['cartão recusado', { formaPagamento: 'cartao', statusPagamento: 'recusado' }, true],
      ['cartão aprovado', { formaPagamento: 'cartao', statusPagamento: 'aprovado' }, false],
      ['pedido inexistente', null, false],
    ];

    for (const [descricao, sobrescritas, esperado] of casos) {
      it(`${descricao} -> ${esperado}`, () => {
        const pedido = sobrescritas ? criarPedido(sobrescritas) : null;
        pedidoServiceSpy.obterPorCodigo.and.returnValue(of(pedido));

        const fixture = configurar();
        fixture.detectChanges();

        expect(fixture.componentInstance.podeRetomarPagamento()).toBe(esperado);
      });
    }
  });
});
