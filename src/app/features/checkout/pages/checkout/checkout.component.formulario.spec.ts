/**
 * Grupo C do plano de testes: o resto do CheckoutComponent que não é a retomada (já coberta
 * 100% em checkout.component.spec.ts) — CEP, cupom, cotação de frete, navegação entre etapas
 * e o pagamento por cartão (pagarComCartao via SDK.js do Mercado Pago).
 */
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { FreteService, OpcaoFrete } from '../../../../core/servicos/frete.service';
import { CepService, EnderecoPorCep } from '../../../../core/servicos/cep.service';
import { CupomService } from '../../../../core/servicos/cupom.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { MercadoPagoSdkService } from '../../../../core/servicos/mercado-pago-sdk.service';

function criarOpcaoFrete(sobrescritas: Partial<OpcaoFrete> = {}): OpcaoFrete {
  return {
    id: 'frete-1',
    nome: 'Correios — PAC',
    prazo: '7 dias úteis',
    preco: 15,
    transportadora: 'Correios',
    servico: 'PAC',
    prazoDias: 7,
    ...sobrescritas,
  };
}

describe('CheckoutComponent — formulário (CEP, cupom, frete, navegação, cartão)', () => {
  let pedidoServiceSpy: jasmine.SpyObj<PedidoService>;
  let freteServiceSpy: jasmine.SpyObj<FreteService>;
  let cepServiceSpy: jasmine.SpyObj<CepService>;
  let cupomServiceSpy: jasmine.SpyObj<CupomService>;
  let mercadoPagoSdkSpy: jasmine.SpyObj<MercadoPagoSdkService>;
  let mpSpy: jasmine.SpyObj<{
    getPaymentMethods: (o: { bin: string }) => Promise<{ results: Array<{ id: string }> }>;
    getIssuers: (o: { paymentMethodId: string; bin: string }) => Promise<Array<{ id: string }>>;
    createCardToken: (d: unknown) => Promise<{ id: string; status: string }>;
  }>;
  let configuracaoSignal: ReturnType<typeof signal<{ cidadesFreteGratis: Array<{ cidade: string; uf: string }> } | null>>;

  function configurar(): ComponentFixture<CheckoutComponent> {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        { provide: PedidoService, useValue: pedidoServiceSpy },
        {
          provide: CarrinhoService,
          useValue: {
            itensCarrinho: signal([]),
            valorTotal: signal(0),
            limparCarrinho: jasmine.createSpy('limparCarrinho'),
          },
        },
        { provide: FreteService, useValue: freteServiceSpy },
        { provide: CepService, useValue: cepServiceSpy },
        { provide: CupomService, useValue: cupomServiceSpy },
        { provide: ConfiguracaoLojaService, useValue: { configuracao: configuracaoSignal } },
        { provide: MercadoPagoSdkService, useValue: mercadoPagoSdkSpy },
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({})) } },
      ],
    });

    const fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    pedidoServiceSpy = jasmine.createSpyObj('PedidoService', [
      'criarPedido',
      'criarPagamentoPix',
      'criarPagamentoCartao',
      'obterPorCodigo',
    ]);
    freteServiceSpy = jasmine.createSpyObj('FreteService', ['cotar']);
    cepServiceSpy = jasmine.createSpyObj('CepService', ['buscarEndereco']);
    cupomServiceSpy = jasmine.createSpyObj('CupomService', ['validar']);
    mpSpy = jasmine.createSpyObj('MercadoPagoSdk', ['getPaymentMethods', 'getIssuers', 'createCardToken']);
    mercadoPagoSdkSpy = jasmine.createSpyObj('MercadoPagoSdkService', ['carregar']);
    mercadoPagoSdkSpy.carregar.and.resolveTo(mpSpy as never);
    configuracaoSignal = signal(null);
  });

  describe('atualizarCep', () => {
    it('não busca endereço enquanto o CEP tem menos de 8 dígitos', () => {
      const fixture = configurar();
      fixture.componentInstance.atualizarCep('1234');

      expect(cepServiceSpy.buscarEndereco).not.toHaveBeenCalled();
      expect(fixture.componentInstance.cep()).toBe('1234');
    });

    it('busca e preenche endereço/bairro/cidade/uf quando o CEP é encontrado', () => {
      const endereco: EnderecoPorCep = {
        endereco: 'Rua das Flores',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
      };
      cepServiceSpy.buscarEndereco.and.returnValue(of(endereco));
      const fixture = configurar();

      fixture.componentInstance.atualizarCep('01310100');

      const comp = fixture.componentInstance;
      expect(cepServiceSpy.buscarEndereco).toHaveBeenCalledWith('01310-100');
      expect(comp.buscandoCep()).toBeFalse();
      expect(comp.endereco()).toBe('Rua das Flores');
      expect(comp.bairro()).toBe('Centro');
      expect(comp.cidade()).toBe('São Paulo');
      expect(comp.uf()).toBe('SP');
      expect(comp.erroCep()).toBeNull();
    });

    it('mostra erro quando o CEP não é encontrado (ViaCEP devolve null)', () => {
      cepServiceSpy.buscarEndereco.and.returnValue(of(null));
      const fixture = configurar();

      fixture.componentInstance.atualizarCep('99999999');

      expect(fixture.componentInstance.erroCep()).toContain('não encontrado');
      expect(fixture.componentInstance.buscandoCep()).toBeFalse();
    });

    it('mostra erro genérico quando a busca falha', () => {
      cepServiceSpy.buscarEndereco.and.returnValue(throwError(() => new Error('rede caiu')));
      const fixture = configurar();

      fixture.componentInstance.atualizarCep('01310100');

      expect(fixture.componentInstance.erroCep()).toContain('Não foi possível buscar');
    });
  });

  describe('cupom', () => {
    it('aplicarCupom com campo vazio não chama o serviço', () => {
      const fixture = configurar();
      fixture.componentInstance.codigoCupom.set('');

      fixture.componentInstance.aplicarCupom();

      expect(cupomServiceSpy.validar).not.toHaveBeenCalled();
    });

    it('aplica o cupom quando o servidor confirma que é válido', () => {
      const resultado = { valido: true as const, codigo: 'PROMO10', tipoDesconto: 'percentual' as const, valorDesconto: 10, desconto: 9 };
      cupomServiceSpy.validar.and.returnValue(of(resultado));
      const fixture = configurar();
      fixture.componentInstance.codigoCupom.set('promo10');

      fixture.componentInstance.aplicarCupom();

      const comp = fixture.componentInstance;
      expect(comp.cupomAplicado()).toEqual(resultado);
      expect(comp.validandoCupom()).toBeFalse();
      expect(comp.erroCupom()).toBeNull();
    });

    it('mostra o motivo quando o servidor recusa o cupom', () => {
      cupomServiceSpy.validar.and.returnValue(of({ valido: false, motivo: 'Cupom expirado' }));
      const fixture = configurar();
      fixture.componentInstance.codigoCupom.set('VENCIDO');

      fixture.componentInstance.aplicarCupom();

      const comp = fixture.componentInstance;
      expect(comp.erroCupom()).toBe('Cupom expirado');
      expect(comp.cupomAplicado()).toBeNull();
    });

    it('mostra erro genérico quando a validação falha (rede)', () => {
      cupomServiceSpy.validar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();
      fixture.componentInstance.codigoCupom.set('QUALQUER');

      fixture.componentInstance.aplicarCupom();

      expect(fixture.componentInstance.erroCupom()).toContain('Não foi possível validar');
    });

    it('removerCupom limpa cupom aplicado, código e erro', () => {
      cupomServiceSpy.validar.and.returnValue(
        of({ valido: true as const, codigo: 'X', tipoDesconto: 'percentual' as const, valorDesconto: 1, desconto: 1 })
      );
      const fixture = configurar();
      fixture.componentInstance.codigoCupom.set('X');
      fixture.componentInstance.aplicarCupom();

      fixture.componentInstance.removerCupom();

      const comp = fixture.componentInstance;
      expect(comp.cupomAplicado()).toBeNull();
      expect(comp.codigoCupom()).toBe('');
      expect(comp.erroCupom()).toBeNull();
    });
  });

  describe('cotarFrete', () => {
    it('usa entrega local grátis (sem chamar o Melhor Envio) quando a cidade está configurada', () => {
      configuracaoSignal.set({ cidadesFreteGratis: [{ cidade: 'Indaiatuba', uf: 'SP' }] });
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.cidade.set('indaiatuba'); // caixa/acento diferente — normalizarTexto cobre isso
      comp.uf.set('sp');

      comp.cotarFrete();

      expect(freteServiceSpy.cotar).not.toHaveBeenCalled();
      expect(comp.freteSelecionado()?.preco).toBe(0);
      expect(comp.valorFrete()).toBe(0);
    });

    it('cota frete de verdade via Melhor Envio quando a cidade não é de entrega local', () => {
      const opcao = criarOpcaoFrete();
      freteServiceSpy.cotar.and.returnValue(of([opcao]));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.cep.set('01310-100');

      comp.cotarFrete();

      expect(freteServiceSpy.cotar).toHaveBeenCalledWith('01310-100', []);
      expect(comp.opcoesFrete()).toEqual([opcao]);
      expect(comp.carregandoFrete()).toBeFalse();
      expect(comp.erroFrete()).toBeNull();
    });

    it('mostra erro quando não há opção de frete disponível', () => {
      freteServiceSpy.cotar.and.returnValue(of([]));
      const fixture = configurar();

      fixture.componentInstance.cotarFrete();

      expect(fixture.componentInstance.erroFrete()).toContain('Nenhuma opção de frete');
    });

    it('mostra erro genérico quando a cotação falha', () => {
      freteServiceSpy.cotar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.cotarFrete();

      expect(fixture.componentInstance.erroFrete()).toContain('Não foi possível calcular o frete');
    });
  });

  describe('navegação entre etapas', () => {
    it('avancar() não sai da etapa atual se ela não está válida', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      expect(comp.etapaAtual()).toBe('contato'); // contatoValido() é false, campos vazios

      comp.avancar();

      expect(comp.etapaAtual()).toBe('contato');
    });

    it('avancar() move pra próxima etapa quando a atual está válida', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.nome.set('Izac Lins');
      comp.email.set('izac@example.com');
      comp.telefone.set('11999999999');
      comp.documento.set('12345678909');

      comp.avancar();

      expect(comp.etapaAtual()).toBe('endereco');
    });

    it('avancar() da etapa endereço pra frete já dispara a cotação', () => {
      freteServiceSpy.cotar.and.returnValue(of([criarOpcaoFrete()]));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.etapaAtual.set('endereco');
      comp.endereco.set('Rua X');
      comp.numero.set('1');
      comp.cidade.set('Cidade');
      comp.uf.set('UF');
      comp.cep.set('00000-000');

      comp.avancar();

      expect(comp.etapaAtual()).toBe('frete');
      expect(freteServiceSpy.cotar).toHaveBeenCalled();
    });

    it('voltar() move pra etapa anterior e não passa do início', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.etapaAtual.set('endereco');

      comp.voltar();
      expect(comp.etapaAtual()).toBe('contato');

      comp.voltar(); // já está na primeira, não deve quebrar nem mudar
      expect(comp.etapaAtual()).toBe('contato');
    });

    it('irParaEtapa() permite pular pra uma etapa já visitada, mas não pra frente', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.etapaAtual.set('frete'); // índice 2

      comp.irParaEtapa('contato'); // índice 0, pra trás — permitido
      expect(comp.etapaAtual()).toBe('contato');

      comp.etapaAtual.set('frete');
      comp.irParaEtapa('revisao'); // índice 4, pra frente — bloqueado
      expect(comp.etapaAtual()).toBe('frete');
    });

    it('etapaConcluida mapeia cada etapa pro computed de validade certo', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;

      expect(comp.etapaConcluida('revisao')).toBeFalse(); // nunca "concluída", é o fim da linha
      expect(comp.etapaConcluida('frete')).toBeFalse(); // sem frete selecionado ainda

      comp.opcoesFrete.set([criarOpcaoFrete()]);
      comp.freteSelecionadoId.set('frete-1');
      expect(comp.etapaConcluida('frete')).toBeTrue();
    });
  });

  describe('pagamento por cartão (pagarComCartao, via tentarNovamente)', () => {
    function prepararCartaoValido(comp: CheckoutComponent): void {
      comp.formaPagamento.set('cartao');
      comp.numeroCartao.set('4235 6477 2802 5682');
      comp.nomeCartao.set('IZAC LINS');
      comp.validadeCartao.set('12/30');
      comp.cvvCartao.set('123');
      comp.cpfCnpjCartao.set('12345678909');
      comp.numeroPedido.set('VT-ABC123');
      comp.valorTotalFinalizado.set(90);
    }

    it('aprovado fecha o pedido (pedidoFinalizado)', fakeAsync(() => {
      mpSpy.getPaymentMethods.and.resolveTo({ results: [{ id: 'master' }] });
      mpSpy.getIssuers.and.resolveTo([{ id: '123' }]);
      mpSpy.createCardToken.and.resolveTo({ id: 'tok_abc', status: 'ok' });
      pedidoServiceSpy.criarPagamentoCartao.and.returnValue(
        of({ idPagamento: '1', status: 'approved', statusDetail: 'accredited' })
      );
      const fixture = configurar();
      prepararCartaoValido(fixture.componentInstance);

      fixture.componentInstance.tentarNovamente();
      tick();

      expect(fixture.componentInstance.pedidoFinalizado()).toBeTrue();
      expect(fixture.componentInstance.finalizandoPedido()).toBeFalse();
      const chamada = pedidoServiceSpy.criarPagamentoCartao.calls.mostRecent().args[0];
      expect(chamada.token).toBe('tok_abc');
      expect(chamada.paymentMethodId).toBe('master');
      expect(chamada.issuerId).toBe('123');
    }));

    it('recusado mostra mensagem específica de recusa', fakeAsync(() => {
      mpSpy.getPaymentMethods.and.resolveTo({ results: [{ id: 'master' }] });
      mpSpy.getIssuers.and.resolveTo([{ id: '123' }]);
      mpSpy.createCardToken.and.resolveTo({ id: 'tok_abc', status: 'ok' });
      pedidoServiceSpy.criarPagamentoCartao.and.returnValue(
        of({ idPagamento: '1', status: 'rejected', statusDetail: 'cc_rejected_other_reason' })
      );
      const fixture = configurar();
      prepararCartaoValido(fixture.componentInstance);

      fixture.componentInstance.tentarNovamente();
      tick();

      expect(fixture.componentInstance.pedidoFinalizado()).toBeFalse();
      expect(fixture.componentInstance.erroFinalizacao()).toContain('recusado');
    }));

    it('status em análise (in_process) mostra mensagem de aguardar', fakeAsync(() => {
      mpSpy.getPaymentMethods.and.resolveTo({ results: [{ id: 'master' }] });
      mpSpy.getIssuers.and.resolveTo([{ id: '123' }]);
      mpSpy.createCardToken.and.resolveTo({ id: 'tok_abc', status: 'ok' });
      pedidoServiceSpy.criarPagamentoCartao.and.returnValue(
        of({ idPagamento: '1', status: 'in_process', statusDetail: 'pending_review' })
      );
      const fixture = configurar();
      prepararCartaoValido(fixture.componentInstance);

      fixture.componentInstance.tentarNovamente();
      tick();

      expect(fixture.componentInstance.erroFinalizacao()).toContain('análise');
    }));

    it('bandeira não reconhecida (getPaymentMethods sem resultado) vira erro genérico', fakeAsync(() => {
      mpSpy.getPaymentMethods.and.resolveTo({ results: [] });
      const fixture = configurar();
      prepararCartaoValido(fixture.componentInstance);

      fixture.componentInstance.tentarNovamente();
      tick();

      expect(fixture.componentInstance.erroFinalizacao()).toContain('Não foi possível processar o cartão');
      expect(pedidoServiceSpy.criarPagamentoCartao).not.toHaveBeenCalled();
    }));

    it('falha na tokenização (createCardToken rejeita) vira erro genérico', fakeAsync(() => {
      mpSpy.getPaymentMethods.and.resolveTo({ results: [{ id: 'master' }] });
      mpSpy.getIssuers.and.resolveTo([{ id: '123' }]);
      mpSpy.createCardToken.and.rejectWith(new Error('cartão inválido'));
      const fixture = configurar();
      prepararCartaoValido(fixture.componentInstance);

      fixture.componentInstance.tentarNovamente();
      tick();

      expect(fixture.componentInstance.erroFinalizacao()).toContain('Não foi possível processar o cartão');
      expect(pedidoServiceSpy.criarPagamentoCartao).not.toHaveBeenCalled();
    }));

    it('sem emissor (getIssuers vazio) ainda envia a cobrança, sem issuerId', fakeAsync(() => {
      mpSpy.getPaymentMethods.and.resolveTo({ results: [{ id: 'visa' }] });
      mpSpy.getIssuers.and.resolveTo([]);
      mpSpy.createCardToken.and.resolveTo({ id: 'tok_x', status: 'ok' });
      pedidoServiceSpy.criarPagamentoCartao.and.returnValue(
        of({ idPagamento: '1', status: 'approved', statusDetail: 'accredited' })
      );
      const fixture = configurar();
      prepararCartaoValido(fixture.componentInstance);

      fixture.componentInstance.tentarNovamente();
      tick();

      const chamada = pedidoServiceSpy.criarPagamentoCartao.calls.mostRecent().args[0];
      expect(chamada.issuerId).toBeUndefined();
    }));
  });
});
