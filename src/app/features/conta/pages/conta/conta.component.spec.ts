import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ContaComponent } from './conta.component';
import { AuthService } from '../../../../core/servicos/auth.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { SolicitacaoTrocaService } from '../../../../core/servicos/solicitacao-troca.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { Pedido } from '../../../../core/modelos/pedido.model';
import { SolicitacaoTroca } from '../../../../core/modelos/solicitacao-troca.model';

function pedido(sobrescritas: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'VT-ABC123',
    criadoEm: new Date().toISOString(),
    status: 'recebido',
    nomeCliente: 'Izac Lins',
    emailCliente: 'izac@example.com',
    telefoneCliente: '11999999999',
    endereco: {
      endereco: 'Rua X',
      numero: '1',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-100',
    },
    itens: [
      {
        produtoNome: 'Camiseta X',
        produtoSlug: 'camiseta-x',
        imagem: '/foto.webp',
        tamanho: 'M',
        cor: 'Preto',
        quantidade: 1,
        precoUnitario: 50,
      },
      {
        produtoNome: 'Camiseta Y',
        produtoSlug: 'camiseta-y',
        imagem: '/foto2.webp',
        tamanho: 'G',
        cor: 'Branco',
        quantidade: 2,
        precoUnitario: 40,
      },
    ],
    formaPagamento: 'pix',
    parcelas: 1,
    valorFrete: 0,
    valorTotal: 130,
    ...sobrescritas,
  };
}

function solicitacao(sobrescritas: Partial<SolicitacaoTroca> = {}): SolicitacaoTroca {
  return {
    id: 'sol-1',
    pedidoCodigo: 'VT-ABC123',
    emailCliente: 'izac@example.com',
    tipo: 'troca',
    itens: [{ produtoNome: 'Camiseta X', produtoSlug: 'camiseta-x', tamanho: 'M', cor: 'Preto', quantidade: 1 }],
    motivo: 'Tamanho errado',
    status: 'pendente',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('ContaComponent — solicitação de troca/devolução', () => {
  let pedidoServiceSpy: jasmine.SpyObj<PedidoService>;
  let solicitacaoTrocaServiceSpy: jasmine.SpyObj<SolicitacaoTrocaService>;
  let autenticadoSignal: ReturnType<typeof signal<boolean>>;

  function configurar(): ComponentFixture<ContaComponent> {
    TestBed.configureTestingModule({
      imports: [ContaComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            autenticado: autenticadoSignal,
            sessao: signal({ user: { email: 'izac@example.com' } }),
            entrarComLinkMagico: () => of(undefined),
            sair: () => of(undefined),
          },
        },
        { provide: PedidoService, useValue: pedidoServiceSpy },
        { provide: CatalogoRepositorio, useValue: jasmine.createSpyObj('CatalogoRepositorio', ['obterProdutoPorSlug']) },
        { provide: CarrinhoService, useValue: jasmine.createSpyObj('CarrinhoService', ['adicionarItem']) },
        { provide: SolicitacaoTrocaService, useValue: solicitacaoTrocaServiceSpy },
        {
          provide: ConfiguracaoLojaService,
          useValue: { configuracao: signal({ nomeLoja: 'Vista Nostálgica' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ContaComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    autenticadoSignal = signal(true);
    pedidoServiceSpy = jasmine.createSpyObj('PedidoService', ['listarMeusPedidos']);
    pedidoServiceSpy.listarMeusPedidos.and.returnValue(of([pedido()]));
    solicitacaoTrocaServiceSpy = jasmine.createSpyObj('SolicitacaoTrocaService', ['criar', 'listarMinhas']);
    solicitacaoTrocaServiceSpy.listarMinhas.and.returnValue(of([]));
  });

  it('carrega as solicitações do cliente junto com os pedidos, ao autenticar', () => {
    solicitacaoTrocaServiceSpy.listarMinhas.and.returnValue(of([solicitacao()]));
    const fixture = configurar();

    expect(fixture.componentInstance.solicitacoes()).toEqual([solicitacao()]);
  });

  it('dentroDoPrazoTroca é true pra pedido recente e false pra pedido com mais de 15 dias', () => {
    const fixture = configurar();
    const comp = fixture.componentInstance;
    const pedidoRecente = pedido({ criadoEm: new Date().toISOString() });
    const pedidoAntigo = pedido({
      criadoEm: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(comp.dentroDoPrazoTroca(pedidoRecente)).toBeTrue();
    expect(comp.dentroDoPrazoTroca(pedidoAntigo)).toBeFalse();
  });

  it('abrirSolicitacao reseta o formulário pro pedido escolhido', () => {
    const fixture = configurar();
    const comp = fixture.componentInstance;
    const meuPedido = pedido();

    comp.abrirSolicitacao(meuPedido);

    expect(comp.pedidoSolicitando()).toBe(meuPedido);
    expect(comp.tipoSolicitacao()).toBe('troca');
    expect(comp.itensMarcados().size).toBe(0);
    expect(comp.motivoSolicitacao()).toBe('');
  });

  it('podeEnviarSolicitacao exige pelo menos um item marcado e um motivo preenchido', () => {
    const fixture = configurar();
    const comp = fixture.componentInstance;
    comp.abrirSolicitacao(pedido());

    expect(comp.podeEnviarSolicitacao()).toBeFalse();

    comp.alternarItemMarcado(0);
    expect(comp.podeEnviarSolicitacao()).toBeFalse(); // ainda falta o motivo

    comp.motivoSolicitacao.set('Tamanho errado');
    expect(comp.podeEnviarSolicitacao()).toBeTrue();

    comp.alternarItemMarcado(0); // desmarca de novo
    expect(comp.podeEnviarSolicitacao()).toBeFalse();
  });

  it('enviarSolicitacao manda só os itens marcados e adiciona a nova solicitação na lista', () => {
    solicitacaoTrocaServiceSpy.criar.and.returnValue(of(solicitacao()));
    const fixture = configurar();
    const comp = fixture.componentInstance;
    const meuPedido = pedido();
    comp.abrirSolicitacao(meuPedido);
    comp.alternarItemMarcado(1); // "Camiseta Y"
    comp.motivoSolicitacao.set('Veio com defeito');

    comp.enviarSolicitacao();

    const chamada = solicitacaoTrocaServiceSpy.criar.calls.mostRecent().args[0];
    expect(chamada.pedidoCodigo).toBe('VT-ABC123');
    expect(chamada.itens).toEqual([
      { produtoNome: 'Camiseta Y', produtoSlug: 'camiseta-y', tamanho: 'G', cor: 'Branco', quantidade: 2 },
    ]);
    expect(chamada.motivo).toBe('Veio com defeito');
    expect(comp.solicitacaoEnviada()).toBeTrue();
    expect(comp.enviandoSolicitacao()).toBeFalse();
    expect(comp.solicitacoes()).toContain(solicitacao());
  });

  it('mostra erro genérico quando o envio falha', () => {
    solicitacaoTrocaServiceSpy.criar.and.returnValue(throwError(() => new Error('falhou')));
    const fixture = configurar();
    const comp = fixture.componentInstance;
    comp.abrirSolicitacao(pedido());
    comp.alternarItemMarcado(0);
    comp.motivoSolicitacao.set('Tamanho errado');

    comp.enviarSolicitacao();

    expect(comp.erroSolicitacao()).toContain('Não foi possível enviar');
    expect(comp.solicitacaoEnviada()).toBeFalse();
  });

  it('fecharSolicitacao limpa o pedido em edição', () => {
    const fixture = configurar();
    const comp = fixture.componentInstance;
    comp.abrirSolicitacao(pedido());

    comp.fecharSolicitacao();

    expect(comp.pedidoSolicitando()).toBeNull();
  });

  describe('baixarComprovante', () => {
    // gerarComprovantePedidoPdf de verdade (import dinâmico do jsPDF) roda aqui — não dá pra
    // espiar a função importada (binding de módulo ES é somente leitura depois do build, ver
    // comentário em supabase.client.ts), então o teste cobre só o que o componente controla:
    // o sinalizador de "gerando" liga e desliga em volta da chamada.
    it('marca codigoGerandoComprovante durante a geração e limpa ao final', async () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      const meuPedido = pedido();

      const promessa = comp.baixarComprovante(meuPedido);
      expect(comp.codigoGerandoComprovante()).toBe(meuPedido.codigo);

      await promessa;

      expect(comp.codigoGerandoComprovante()).toBeNull();
    });
  });
});
