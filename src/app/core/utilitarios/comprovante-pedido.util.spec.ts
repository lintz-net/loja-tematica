import { formatarMoeda, montarLinhasComprovante } from './comprovante-pedido.util';
import { Pedido } from '../modelos/pedido.model';

function pedido(sobrescritas: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'VT-ABC123',
    criadoEm: '2026-01-15T12:00:00.000Z',
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
        quantidade: 2,
        precoUnitario: 49.9,
      },
    ],
    formaPagamento: 'pix',
    parcelas: 1,
    valorFrete: 10,
    valorTotal: 109.8,
    ...sobrescritas,
  };
}

describe('montarLinhasComprovante', () => {
  it('inclui nome da loja, código, data e cliente', () => {
    const linhas = montarLinhasComprovante(pedido(), 'Vista Nostálgica');

    expect(linhas).toContain('Vista Nostálgica');
    expect(linhas).toContain('Pedido: VT-ABC123');
    expect(linhas).toContain('Data: 15/01/2026');
    expect(linhas).toContain('Cliente: Izac Lins');
    expect(linhas).toContain('E-mail: izac@example.com');
  });

  it('lista cada item com quantidade, tamanho/cor e subtotal do item', () => {
    const linhas = montarLinhasComprovante(pedido(), 'Loja');

    expect(linhas).toContain(`2x Camiseta Batman (M/Preto) — ${formatarMoeda(99.8)}`);
  });

  it('mostra subtotal, frete e total', () => {
    const linhas = montarLinhasComprovante(pedido(), 'Loja');

    expect(linhas).toContain(`Subtotal: ${formatarMoeda(99.8)}`);
    expect(linhas).toContain(`Frete: ${formatarMoeda(10)}`);
    expect(linhas).toContain(`Total: ${formatarMoeda(109.8)}`);
  });

  it('mostra "Grátis" quando o frete é zero', () => {
    const linhas = montarLinhasComprovante(pedido({ valorFrete: 0 }), 'Loja');

    expect(linhas).toContain('Frete: Grátis');
  });

  it('mostra o desconto com o código do cupom, quando existe', () => {
    const linhas = montarLinhasComprovante(
      pedido({ valorDesconto: 15, cupomCodigo: 'PROMO10' }),
      'Loja'
    );

    expect(linhas).toContain(`Desconto (PROMO10): -${formatarMoeda(15)}`);
  });

  it('não mostra linha de desconto quando não há cupom', () => {
    const linhas = montarLinhasComprovante(pedido(), 'Loja');

    expect(linhas.some((linha) => linha.startsWith('Desconto'))).toBeFalse();
  });

  it('mostra a forma de pagamento, com parcelas só pra cartão parcelado', () => {
    const linhasPix = montarLinhasComprovante(pedido(), 'Loja');
    expect(linhasPix).toContain('Forma de pagamento: Pix');

    const linhasCartaoAVista = montarLinhasComprovante(
      pedido({ formaPagamento: 'cartao', parcelas: 1 }),
      'Loja'
    );
    expect(linhasCartaoAVista).toContain('Forma de pagamento: Cartão de crédito');

    const linhasCartaoParcelado = montarLinhasComprovante(
      pedido({ formaPagamento: 'cartao', parcelas: 3 }),
      'Loja'
    );
    expect(linhasCartaoParcelado).toContain('Forma de pagamento: Cartão de crédito em 3x');
  });

  it('inclui o endereço de entrega, com complemento quando existe', () => {
    const linhas = montarLinhasComprovante(
      pedido({ endereco: { ...pedido().endereco, complemento: 'Apto 45' } }),
      'Loja'
    );

    expect(linhas).toContain('Rua das Flores, 100 — Apto 45');
    expect(linhas).toContain('Centro — São Paulo/SP — CEP 01310-100');
  });

  it('endereço sem complemento não deixa "— " sobrando', () => {
    const linhas = montarLinhasComprovante(pedido(), 'Loja');

    expect(linhas).toContain('Rua das Flores, 100');
  });
});
