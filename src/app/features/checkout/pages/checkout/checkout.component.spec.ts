/**
 * Cobre só o que foi mexido na sessão da "retomada de pagamento" (modoRetomada):
 * bootstrap via /checkout/:codigoRetomada, os computeds subtotal/valorDesconto que passam a
 * depender do pedido retomado, tentarNovamente() e o polling que detecta uma aprovação/recusa
 * silenciosa enquanto o cliente ainda está na tela de revisão. NÃO cobre o resto do
 * CheckoutComponent (CEP, cupom, cotação de frete, etapas do formulário normal) — decisão
 * explícita de escopo, não esquecimento.
 */
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { FreteService } from '../../../../core/servicos/frete.service';
import { CepService } from '../../../../core/servicos/cep.service';
import { CupomService } from '../../../../core/servicos/cupom.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { Pedido } from '../../../../core/modelos/pedido.model';

function criarPedido(sobrescritas: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'PED-001',
    criadoEm: '2026-09-24T12:00:00.000Z',
    status: 'recebido',
    nomeCliente: 'Izac Lins',
    emailCliente: 'izac@example.com',
    telefoneCliente: '11999999999',
    documentoCliente: '12345678909',
    endereco: {
      endereco: 'Rua das Flores',
      numero: '100',
      complemento: 'Apto 2',
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
        quantidade: 2,
        precoUnitario: 45,
      },
    ],
    formaPagamento: 'pix',
    parcelas: 1,
    valorFrete: 12,
    valorTotal: 102,
    valorDesconto: 0,
    freteTransportadora: 'Correios',
    freteServicoNome: 'PAC',
    fretePrazoDias: 7,
    statusPagamento: 'pendente',
    ...sobrescritas,
  };
}

describe('CheckoutComponent — modoRetomada', () => {
  let pedidoServiceSpy: jasmine.SpyObj<PedidoService>;
  let carrinhoServiceStub: {
    itensCarrinho: () => unknown[];
    valorTotal: () => number;
    limparCarrinho: jasmine.Spy;
  };
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  function configurar(): ComponentFixture<CheckoutComponent> {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        { provide: PedidoService, useValue: pedidoServiceSpy },
        { provide: CarrinhoService, useValue: carrinhoServiceStub },
        { provide: FreteService, useValue: jasmine.createSpyObj('FreteService', ['cotar']) },
        { provide: CepService, useValue: jasmine.createSpyObj('CepService', ['buscarEndereco']) },
        { provide: CupomService, useValue: jasmine.createSpyObj('CupomService', ['validar']) },
        {
          provide: ConfiguracaoLojaService,
          useValue: { configuracao: signal(null) },
        },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
      ],
    });

    const fixture = TestBed.createComponent(CheckoutComponent);
    router = TestBed.inject(Router);
    return fixture;
  }

  beforeEach(() => {
    pedidoServiceSpy = jasmine.createSpyObj('PedidoService', [
      'obterPorCodigo',
      'criarPagamentoPix',
      'criarPedido',
    ]);
    carrinhoServiceStub = {
      itensCarrinho: signal([]),
      valorTotal: signal(0),
      limparCarrinho: jasmine.createSpy('limparCarrinho'),
    };
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
  });

  describe('sem codigoRetomada na rota (checkout normal)', () => {
    it('não entra em modoRetomada nem chama obterPorCodigo', () => {
      const fixture = configurar();
      fixture.detectChanges();

      expect(fixture.componentInstance.modoRetomada()).toBeFalse();
      expect(fixture.componentInstance.carregandoRetomada()).toBeFalse();
      expect(pedidoServiceSpy.obterPorCodigo).not.toHaveBeenCalled();
    });
  });

  describe('pedido não retomável', () => {
    const casosRedirecionamento: Array<[string, Partial<Pedido>]> = [
      ['forma de pagamento cartão', { formaPagamento: 'cartao' }],
      ['status aprovado', { statusPagamento: 'aprovado' }],
      ['status cancelado', { statusPagamento: 'cancelado' }],
      ['status expirado', { statusPagamento: 'expirado' }],
    ];

    for (const [descricao, sobrescritas] of casosRedirecionamento) {
      it(`redireciona pra /pedido/:codigo quando ${descricao}`, () => {
        pedidoServiceSpy.obterPorCodigo.and.returnValue(of(criarPedido(sobrescritas)));
        const fixture = configurar();
        spyOn(router, 'navigate');

        paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
        fixture.detectChanges();

        expect(router.navigate).toHaveBeenCalledWith(['/pedido', 'PED-001']);
        expect(fixture.componentInstance.etapaAtual()).not.toBe('revisao');
      });
    }

    it('redireciona quando o pedido não existe (null)', () => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(of(null));
      const fixture = configurar();
      spyOn(router, 'navigate');

      paramMap$.next(convertToParamMap({ codigoRetomada: 'INEXISTENTE' }));
      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/pedido', 'INEXISTENTE']);
    });

    it('redireciona quando obterPorCodigo falha', () => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(throwError(() => new Error('rede caiu')));
      const fixture = configurar();
      spyOn(router, 'navigate');

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/pedido', 'PED-001']);
    });
  });

  describe('pedido retomável (Pix pendente ou recusado)', () => {
    it('popula os campos de exibição e cai na etapa de revisão', fakeAsync(() => {
      const pedido = criarPedido();
      pedidoServiceSpy.obterPorCodigo.and.returnValue(of(pedido));
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      expect(comp.modoRetomada()).toBeTrue();
      expect(comp.carregandoRetomada()).toBeFalse();
      expect(comp.pedidoRetomado()).toEqual(pedido);
      expect(comp.numeroPedido()).toBe('PED-001');
      expect(comp.valorTotalFinalizado()).toBe(102);
      expect(comp.nome()).toBe('Izac Lins');
      expect(comp.email()).toBe('izac@example.com');
      expect(comp.telefone()).toBe('11999999999');
      expect(comp.documento()).toBe('12345678909');
      expect(comp.endereco()).toBe('Rua das Flores');
      expect(comp.numero()).toBe('100');
      expect(comp.complemento()).toBe('Apto 2');
      expect(comp.bairro()).toBe('Centro');
      expect(comp.cidade()).toBe('São Paulo');
      expect(comp.uf()).toBe('SP');
      expect(comp.cep()).toBe('01310-100');
      expect(comp.formaPagamento()).toBe('pix');
      expect(comp.etapaAtual()).toBe('revisao');

      // Frete sintetizado a partir do pedido — reaproveita o computed normal.
      expect(comp.freteSelecionado()?.nome).toBe('Correios — PAC');
      expect(comp.valorFrete()).toBe(12);

      // subtotal/valorDesconto/valorTotal via pedido, não via carrinho (que está vazio).
      expect(comp.subtotal()).toBe(90); // 102 - 12 + 0
      expect(comp.valorDesconto()).toBe(0);
      expect(comp.valorTotal()).toBe(102);

      discardPeriodicTasks();
    }));

    it('permite retomar pedido com status recusado', fakeAsync(() => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(of(criarPedido({ statusPagamento: 'recusado' })));
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.modoRetomada()).toBeTrue();
      expect(fixture.componentInstance.etapaAtual()).toBe('revisao');

      discardPeriodicTasks();
    }));

    it('usa "Entrega combinada" quando o pedido não tem transportadora/serviço salvos', fakeAsync(() => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(
        of(
          criarPedido({
            freteTransportadora: undefined,
            freteServicoNome: undefined,
            fretePrazoDias: undefined,
          })
        )
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.freteSelecionado()?.nome).toBe('Entrega combinada');

      discardPeriodicTasks();
    }));

    it('calcula subtotal considerando um valorDesconto existente', fakeAsync(() => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(
        of(criarPedido({ valorTotal: 90, valorFrete: 12, valorDesconto: 10, cupomCodigo: 'PROMO10' }))
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      expect(comp.valorDesconto()).toBe(10);
      expect(comp.subtotal()).toBe(88); // 90 - 12 + 10
      expect(comp.valorTotal()).toBe(90);

      discardPeriodicTasks();
    }));

    it('inicia polling e troca pra tela de sucesso se o pagamento já foi aprovado por trás', fakeAsync(() => {
      const pedido = criarPedido();
      pedidoServiceSpy.obterPorCodigo.and.returnValues(
        of(pedido), // carga inicial
        of({ ...pedido, statusPagamento: 'aprovado' }) // primeiro tick do polling
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.pedidoFinalizado()).toBeFalse();

      tick(4000);

      expect(pedidoServiceSpy.obterPorCodigo).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.pedidoFinalizado()).toBeTrue();
      expect(fixture.componentInstance.aguardandoPix()).toBeFalse();

      discardPeriodicTasks();
    }));

    it('para de pollar quando o pedido é recusado de novo, sem travar em revisão', fakeAsync(() => {
      const pedido = criarPedido();
      pedidoServiceSpy.obterPorCodigo.and.returnValues(
        of(pedido),
        of({ ...pedido, statusPagamento: 'recusado' })
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();
      tick(4000);

      expect(fixture.componentInstance.statusPagamentoPix()).toBe('recusado');
      expect(fixture.componentInstance.pedidoFinalizado()).toBeFalse();

      // parou de pollar: mais um tick não gera nova chamada
      tick(4000);
      expect(pedidoServiceSpy.obterPorCodigo).toHaveBeenCalledTimes(2);
    }));

    it('recarrega o pedido certo se o parâmetro de rota mudar sem recriar o componente', fakeAsync(() => {
      const pedidoA = criarPedido({ codigo: 'PED-A', nomeCliente: 'Cliente A' });
      const pedidoB = criarPedido({ codigo: 'PED-B', nomeCliente: 'Cliente B' });
      pedidoServiceSpy.obterPorCodigo.and.callFake((codigo: string) =>
        of(codigo === 'PED-A' ? pedidoA : pedidoB)
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-A' }));
      fixture.detectChanges();
      expect(fixture.componentInstance.nome()).toBe('Cliente A');

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-B' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.nome()).toBe('Cliente B');
      expect(fixture.componentInstance.numeroPedido()).toBe('PED-B');

      discardPeriodicTasks();
    }));
  });

  describe('preenchimento de campos opcionais ausentes', () => {
    it('documento e complemento vazios viram string vazia, não undefined', fakeAsync(() => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(
        of(
          criarPedido({
            documentoCliente: undefined,
            endereco: {
              endereco: 'Rua X',
              numero: '1',
              bairro: 'Bairro',
              cidade: 'Cidade',
              uf: 'UF',
              cep: '00000-000',
              // complemento ausente de propósito
            },
          })
        )
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.documento()).toBe('');
      expect(fixture.componentInstance.complemento()).toBe('');

      discardPeriodicTasks();
    }));

    it('valorDesconto ausente no pedido vira 0 em vez de undefined', fakeAsync(() => {
      pedidoServiceSpy.obterPorCodigo.and.returnValue(
        of(criarPedido({ valorDesconto: undefined }))
      );
      const fixture = configurar();

      paramMap$.next(convertToParamMap({ codigoRetomada: 'PED-001' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.valorDesconto()).toBe(0);

      discardPeriodicTasks();
    }));
  });

  describe('subtotal em modoRetomada sem pedido carregado ainda', () => {
    it('devolve 0 em vez de quebrar, se lido antes do pedido chegar', () => {
      // Situação sintética: modoRetomada true mas pedidoRetomado ainda null — a janela real
      // entre `modoRetomada.set(true)` e o pedido resolver, que o template nunca expõe (só
      // mostra "Carregando pedido…" nesse intervalo), mas o computed precisa ser defensivo.
      const fixture = configurar();
      fixture.detectChanges();
      fixture.componentInstance.modoRetomada.set(true);

      expect(fixture.componentInstance.subtotal()).toBe(0);
    });
  });

  describe('tentarNovamente', () => {
    it('gera Pix de novo pro pedido existente sem chamar criarPedido, quando já há numeroPedido', () => {
      pedidoServiceSpy.criarPagamentoPix.and.returnValue(
        of({ idPagamento: '1', qrCode: 'copia-e-cola', qrCodeBase64: 'base64', expiraEm: '2026-01-01T00:00:00Z' })
      );
      const fixture = configurar();
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      comp.numeroPedido.set('PED-001');
      comp.valorTotalFinalizado.set(102);
      comp.email.set('izac@example.com');
      comp.nome.set('Izac Lins');

      comp.tentarNovamente();

      expect(pedidoServiceSpy.criarPagamentoPix).toHaveBeenCalledWith(
        jasmine.objectContaining({ codigoPedido: 'PED-001', valorTotal: 102 })
      );
      expect(pedidoServiceSpy.criarPedido).not.toHaveBeenCalled();
    });

    it('cai em finalizarPedido quando o pedido ainda não foi criado', () => {
      const fixture = configurar();
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      const finalizarSpy = spyOn(comp, 'finalizarPedido');
      comp.numeroPedido.set('');

      comp.tentarNovamente();

      expect(finalizarSpy).toHaveBeenCalled();
      expect(pedidoServiceSpy.criarPagamentoPix).not.toHaveBeenCalled();
    });
  });
});
