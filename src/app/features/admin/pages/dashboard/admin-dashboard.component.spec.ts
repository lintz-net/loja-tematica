import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { Pedido } from '../../../../core/modelos/pedido.model';

function criarPedido(sobrescritas: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'VT-ABC123',
    criadoEm: new Date().toISOString(),
    status: 'recebido',
    nomeCliente: 'Izac Lins',
    emailCliente: 'izac@example.com',
    telefoneCliente: '11999999999',
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
        precoUnitario: 50,
      },
    ],
    formaPagamento: 'pix',
    parcelas: 1,
    valorFrete: 10,
    valorTotal: 60,
    ...sobrescritas,
  };
}

describe('AdminDashboardComponent', () => {
  let pedidoServiceSpy: jasmine.SpyObj<PedidoService>;

  function configurar(): ComponentFixture<AdminDashboardComponent> {
    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [{ provide: PedidoService, useValue: pedidoServiceSpy }],
    });
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    pedidoServiceSpy = jasmine.createSpyObj('PedidoService', ['listarTodos']);
  });

  it('mostra erro quando a listagem falha', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar os dados');
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });

  it('calcula totalPedidos, totalVendido e ticketMedio', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(
      of([criarPedido({ valorTotal: 60 }), criarPedido({ valorTotal: 40 })])
    );

    const fixture = configurar();
    const comp = fixture.componentInstance;

    expect(comp.totalPedidos()).toBe(2);
    expect(comp.totalVendido()).toBe(100);
    expect(comp.ticketMedio()).toBe(50);
  });

  it('ticketMedio é 0 quando não há pedidos', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(of([]));

    const fixture = configurar();

    expect(fixture.componentInstance.ticketMedio()).toBe(0);
  });

  it('filtra os pedidos dos últimos 30 dias pra totalPedidos30Dias/totalVendido30Dias', () => {
    const recente = criarPedido({ criadoEm: new Date().toISOString(), valorTotal: 60 });
    const antigo = criarPedido({
      criadoEm: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      valorTotal: 999,
    });
    pedidoServiceSpy.listarTodos.and.returnValue(of([recente, antigo]));

    const fixture = configurar();
    const comp = fixture.componentInstance;

    expect(comp.totalPedidos30Dias()).toBe(1);
    expect(comp.totalVendido30Dias()).toBe(60);
  });

  it('pedidosPorStatus conta corretamente por status e maiorContagemStatus reflete o maior valor', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(
      of([
        criarPedido({ status: 'recebido' }),
        criarPedido({ status: 'recebido' }),
        criarPedido({ status: 'entregue' }),
      ])
    );

    const fixture = configurar();
    const comp = fixture.componentInstance;

    expect(comp.pedidosPorStatus()).toEqual({
      recebido: 2,
      confirmado: 0,
      enviado: 0,
      entregue: 1,
    });
    expect(comp.maiorContagemStatus()).toBe(2);
  });

  it('maiorContagemStatus é pelo menos 1 quando não há pedidos (evita divisão por zero na UI)', () => {
    pedidoServiceSpy.listarTodos.and.returnValue(of([]));

    const fixture = configurar();

    expect(fixture.componentInstance.maiorContagemStatus()).toBe(1);
  });

  it('produtosMaisVendidos agrupa por slug, soma quantidade/receita e ordena por quantidade desc', () => {
    const pedido1 = criarPedido({
      itens: [
        {
          produtoNome: 'Camiseta Batman',
          produtoSlug: 'camiseta-batman',
          imagem: '/a.webp',
          tamanho: 'M',
          cor: 'Preto',
          quantidade: 2,
          precoUnitario: 50,
        },
      ],
    });
    const pedido2 = criarPedido({
      itens: [
        {
          produtoNome: 'Camiseta Batman',
          produtoSlug: 'camiseta-batman',
          imagem: '/a.webp',
          tamanho: 'G',
          cor: 'Preto',
          quantidade: 1,
          precoUnitario: 50,
        },
        {
          produtoNome: 'Caneca Coringa',
          produtoSlug: 'caneca-coringa',
          imagem: '/b.webp',
          tamanho: 'Único',
          cor: 'Branco',
          quantidade: 5,
          precoUnitario: 30,
        },
      ],
    });
    pedidoServiceSpy.listarTodos.and.returnValue(of([pedido1, pedido2]));

    const fixture = configurar();
    const resultado = fixture.componentInstance.produtosMaisVendidos();

    expect(resultado.length).toBe(2);
    expect(resultado[0]).toEqual(
      jasmine.objectContaining({ produtoSlug: 'caneca-coringa', quantidade: 5, receita: 150 })
    );
    expect(resultado[1]).toEqual(
      jasmine.objectContaining({ produtoSlug: 'camiseta-batman', quantidade: 3, receita: 150 })
    );
  });

  it('produtosMaisVendidos limita a 10 produtos', () => {
    const pedido = criarPedido({
      itens: Array.from({ length: 15 }, (_, i) => ({
        produtoNome: `Produto ${i}`,
        produtoSlug: `produto-${i}`,
        imagem: '/x.webp',
        tamanho: 'Único',
        cor: 'Preto',
        quantidade: 1,
        precoUnitario: 10,
      })),
    });
    pedidoServiceSpy.listarTodos.and.returnValue(of([pedido]));

    const fixture = configurar();

    expect(fixture.componentInstance.produtosMaisVendidos().length).toBe(10);
  });
});
