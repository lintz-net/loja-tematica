import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminPedidosComponent } from './admin-pedidos.component';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { EnvioService, Envio } from '../../../../core/servicos/envio.service';
import { Pedido } from '../../../../core/modelos/pedido.model';

function criarPedido(sobrescritas: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'VT-ABC123',
    criadoEm: '2026-09-25T12:00:00.000Z',
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
    itens: [],
    formaPagamento: 'pix',
    parcelas: 1,
    valorFrete: 10,
    valorTotal: 59.9,
    ...sobrescritas,
  };
}

function criarEnvio(sobrescritas: Partial<Envio> = {}): Envio {
  return {
    id: 'env-1',
    codigoPedido: 'VT-ABC123',
    statusEnvio: 'aguardando_compra',
    urlEtiqueta: null,
    codigoRastreio: null,
    erroCompraEtiqueta: null,
    ...sobrescritas,
  };
}

describe('AdminPedidosComponent', () => {
  let pedidoServiceSpy: jasmine.SpyObj<PedidoService>;
  let envioServiceSpy: jasmine.SpyObj<EnvioService>;

  function configurar(): ComponentFixture<AdminPedidosComponent> {
    TestBed.configureTestingModule({
      imports: [AdminPedidosComponent],
      providers: [
        { provide: PedidoService, useValue: pedidoServiceSpy },
        { provide: EnvioService, useValue: envioServiceSpy },
      ],
    });
    const fixture = TestBed.createComponent(AdminPedidosComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    pedidoServiceSpy = jasmine.createSpyObj('PedidoService', ['listarTodos', 'atualizarStatus']);
    envioServiceSpy = jasmine.createSpyObj('EnvioService', ['listarTodos', 'comprarEtiqueta']);
    envioServiceSpy.listarTodos.and.returnValue(of(new Map()));
  });

  it('carrega os pedidos e depois os envios', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(of([criarPedido()]));
    envioServiceSpy.listarTodos.and.returnValue(of(new Map([['VT-ABC123', criarEnvio()]])));

    const fixture = configurar();
    const comp = fixture.componentInstance;

    expect(comp.carregando()).toBeFalse();
    expect(comp.pedidos()).toEqual([criarPedido()]);
    expect(comp.envioDoPedido('VT-ABC123')).toEqual(criarEnvio());
  });

  it('mostra erro quando a listagem de pedidos falha', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar os pedidos');
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });

  it('não bloqueia a listagem quando a busca de envios falha', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(of([criarPedido()]));
    envioServiceSpy.listarTodos.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.pedidos()).toEqual([criarPedido()]);
    expect(fixture.componentInstance.erro()).toBeNull();
  });

  it('envioDoPedido devolve null quando não há envio pro código', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(of([criarPedido()]));
    const fixture = configurar();

    expect(fixture.componentInstance.envioDoPedido('inexistente')).toBeNull();
  });

  describe('aguardaConfirmacaoManual / filtro', () => {
    it('identifica pedido de entrega local confirmado e pago como aguardando manual', () => {
      const pedido = criarPedido({
        freteServicoId: undefined,
        freteTransportadora: 'Entrega local',
        statusPagamento: 'aprovado',
        status: 'confirmado',
      });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      const fixture = configurar();

      expect(fixture.componentInstance.aguardaConfirmacaoManual(pedido)).toBeTrue();
    });

    it('não marca pedido com serviço de frete real (Melhor Envio) como aguardando manual', () => {
      const pedido = criarPedido({
        freteServicoId: '123',
        freteTransportadora: 'Correios',
        statusPagamento: 'aprovado',
        status: 'confirmado',
      });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      const fixture = configurar();

      expect(fixture.componentInstance.aguardaConfirmacaoManual(pedido)).toBeFalse();
    });

    it('quantidadeAguardandoManual e pedidosFiltrados refletem o filtro somenteAguardandoManual', () => {
      const manual = criarPedido({
        codigo: 'VT-MANUAL',
        freteServicoId: undefined,
        freteTransportadora: 'Entrega local',
        statusPagamento: 'aprovado',
        status: 'confirmado',
      });
      const normal = criarPedido({ codigo: 'VT-NORMAL', freteServicoId: '1' });
      pedidoServiceSpy.listarTodos.and.returnValue(of([manual, normal]));
      const fixture = configurar();
      const comp = fixture.componentInstance;

      expect(comp.quantidadeAguardandoManual()).toBe(1);
      expect(comp.pedidosFiltrados().length).toBe(2);

      comp.somenteAguardandoManual.set(true);

      expect(comp.pedidosFiltrados()).toEqual([manual]);
    });
  });

  describe('podeComprarEtiqueta', () => {
    it('é falso quando o pedido não tem frete escolhido (freteServicoId)', () => {
      const pedido = criarPedido({ freteServicoId: undefined });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      const fixture = configurar();

      expect(fixture.componentInstance.podeComprarEtiqueta(pedido)).toBeFalse();
    });

    it('é verdadeiro quando não há envio ainda', () => {
      const pedido = criarPedido({ freteServicoId: '1' });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      const fixture = configurar();

      expect(fixture.componentInstance.podeComprarEtiqueta(pedido)).toBeTrue();
    });

    it('é verdadeiro quando o envio falhou antes (pendente_etiqueta) — permite retry', () => {
      const pedido = criarPedido({ freteServicoId: '1' });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      envioServiceSpy.listarTodos.and.returnValue(
        of(new Map([[pedido.codigo, criarEnvio({ statusEnvio: 'pendente_etiqueta' })]]))
      );
      const fixture = configurar();

      expect(fixture.componentInstance.podeComprarEtiqueta(pedido)).toBeTrue();
    });

    it('é falso quando o envio já foi gerado', () => {
      const pedido = criarPedido({ freteServicoId: '1' });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      envioServiceSpy.listarTodos.and.returnValue(
        of(new Map([[pedido.codigo, criarEnvio({ statusEnvio: 'gerado' })]]))
      );
      const fixture = configurar();

      expect(fixture.componentInstance.podeComprarEtiqueta(pedido)).toBeFalse();
    });
  });

  describe('comprarEtiqueta', () => {
    it('usa o documentoCliente do pedido sem perguntar nada quando já existe', async () => {
      const promptSpy = spyOn(window, 'prompt');
      const pedido = criarPedido({ documentoCliente: '12345678909' });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      envioServiceSpy.comprarEtiqueta.and.returnValue(Promise.resolve({ ok: true }));
      const fixture = configurar();

      await fixture.componentInstance.comprarEtiqueta(pedido);

      expect(promptSpy).not.toHaveBeenCalled();
      expect(envioServiceSpy.comprarEtiqueta).toHaveBeenCalledWith(pedido.codigo, '12345678909');
      expect(fixture.componentInstance.codigoComprandoEtiqueta()).toBeNull();
    });

    it('pede o documento via prompt quando o pedido não tem documentoCliente', async () => {
      spyOn(window, 'prompt').and.returnValue('98765432100');
      const pedido = criarPedido({ documentoCliente: undefined });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      envioServiceSpy.comprarEtiqueta.and.returnValue(Promise.resolve({ ok: true }));
      const fixture = configurar();

      await fixture.componentInstance.comprarEtiqueta(pedido);

      expect(envioServiceSpy.comprarEtiqueta).toHaveBeenCalledWith(pedido.codigo, '98765432100');
    });

    it('cancela sem chamar o serviço quando o admin cancela o prompt', async () => {
      spyOn(window, 'prompt').and.returnValue(null);
      const pedido = criarPedido({ documentoCliente: undefined });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      const fixture = configurar();

      await fixture.componentInstance.comprarEtiqueta(pedido);

      expect(envioServiceSpy.comprarEtiqueta).not.toHaveBeenCalled();
    });

    it('mostra erro quando a compra da etiqueta falha', async () => {
      const pedido = criarPedido({ documentoCliente: '12345678909' });
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      envioServiceSpy.comprarEtiqueta.and.returnValue(
        Promise.resolve({ ok: false, error: 'CEP inválido' })
      );
      const fixture = configurar();

      await fixture.componentInstance.comprarEtiqueta(pedido);

      expect(fixture.componentInstance.erro()).toContain('CEP inválido');
      expect(fixture.componentInstance.codigoComprandoEtiqueta()).toBeNull();
    });
  });

  describe('atualizarStatus', () => {
    it('atualiza o pedido na lista local quando dá certo', () => {
      const pedido = criarPedido();
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      const pedidoAtualizado = { ...pedido, status: 'confirmado' as const };
      pedidoServiceSpy.atualizarStatus.and.returnValue(of(pedidoAtualizado));
      const fixture = configurar();

      fixture.componentInstance.atualizarStatus(pedido.codigo, 'confirmado');

      expect(fixture.componentInstance.pedidos()[0].status).toBe('confirmado');
      expect(fixture.componentInstance.codigoSalvando()).toBeNull();
    });

    it('mostra erro quando a atualização de status falha', () => {
      const pedido = criarPedido();
      pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));
      pedidoServiceSpy.atualizarStatus.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.atualizarStatus(pedido.codigo, 'confirmado');

      expect(fixture.componentInstance.erro()).toContain('Não foi possível atualizar o pedido');
      expect(fixture.componentInstance.codigoSalvando()).toBeNull();
    });
  });
});
