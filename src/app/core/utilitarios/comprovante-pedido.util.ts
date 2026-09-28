import { Pedido } from '../modelos/pedido.model';

/** Exportado só pra reaproveitar a formatação exata (com o espaço não separável do
 * `toLocaleString`) nos asserts do spec, em vez de duplicar a string esperada na mão. */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const ROTULOS_FORMA_PAGAMENTO: Record<Pedido['formaPagamento'], string> = {
  pix: 'Pix',
  cartao: 'Cartão de crédito',
};

/** Monta o conteúdo (linhas de texto) do comprovante — separado da geração do PDF em si
 * (`gerarComprovantePedidoPdf`) pra ficar testável sem depender da biblioteca jsPDF. NÃO é
 * uma nota fiscal (sem validade jurídica/fiscal) — só um resumo do pedido pro cliente
 * guardar, gerado inteiramente no navegador. */
export function montarLinhasComprovante(pedido: Pedido, nomeLoja: string): string[] {
  const linhas: string[] = [
    nomeLoja,
    'Comprovante de compra (não é nota fiscal)',
    '',
    `Pedido: ${pedido.codigo}`,
    `Data: ${formatarData(pedido.criadoEm)}`,
    `Cliente: ${pedido.nomeCliente}`,
    `E-mail: ${pedido.emailCliente}`,
    '',
    'Itens:',
  ];

  for (const item of pedido.itens) {
    linhas.push(
      `${item.quantidade}x ${item.produtoNome} (${item.tamanho}/${item.cor}) — ${formatarMoeda(item.precoUnitario * item.quantidade)}`
    );
  }

  linhas.push(
    '',
    `Subtotal: ${formatarMoeda(pedido.itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0))}`,
    `Frete: ${pedido.valorFrete === 0 ? 'Grátis' : formatarMoeda(pedido.valorFrete)}`
  );

  if (pedido.valorDesconto) {
    linhas.push(`Desconto${pedido.cupomCodigo ? ` (${pedido.cupomCodigo})` : ''}: -${formatarMoeda(pedido.valorDesconto)}`);
  }

  linhas.push(
    `Total: ${formatarMoeda(pedido.valorTotal)}`,
    `Forma de pagamento: ${ROTULOS_FORMA_PAGAMENTO[pedido.formaPagamento]}${pedido.formaPagamento === 'cartao' && pedido.parcelas > 1 ? ` em ${pedido.parcelas}x` : ''}`,
    '',
    'Endereço de entrega:',
    `${pedido.endereco.endereco}, ${pedido.endereco.numero}${pedido.endereco.complemento ? ` — ${pedido.endereco.complemento}` : ''}`,
    `${pedido.endereco.bairro} — ${pedido.endereco.cidade}/${pedido.endereco.uf} — CEP ${pedido.endereco.cep}`
  );

  return linhas;
}

/** Gera e baixa o PDF do comprovante — import dinâmico do jsPDF (~380kB) pra não engordar o
 * bundle principal, só carregado quando o cliente clica em "Baixar comprovante" de verdade. */
export async function gerarComprovantePedidoPdf(pedido: Pedido, nomeLoja: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const linhas = montarLinhasComprovante(pedido, nomeLoja);

  const margemEsquerda = 15;
  let y = 20;
  const alturaLinha = 7;
  const alturaPagina = doc.internal.pageSize.getHeight();

  doc.setFontSize(11);
  for (const linha of linhas) {
    if (y > alturaPagina - 15) {
      doc.addPage();
      y = 20;
    }
    doc.text(linha, margemEsquerda, y);
    y += alturaLinha;
  }

  doc.save(`comprovante-${pedido.codigo}.pdf`);
}
