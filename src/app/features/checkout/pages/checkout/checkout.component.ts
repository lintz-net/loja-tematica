import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { FreteService, OpcaoFrete } from '../../../../core/servicos/frete.service';
import { ItemPedido } from '../../../../core/modelos/pedido.model';
import { imagemDaVariante } from '../../../../core/utilitarios/imagem-produto.util';

type EtapaCheckout = 'contato' | 'endereco' | 'frete' | 'pagamento' | 'revisao';

interface DefinicaoEtapa {
  id: EtapaCheckout;
  rotulo: string;
}

const ETAPAS: DefinicaoEtapa[] = [
  { id: 'contato', rotulo: 'Contato' },
  { id: 'endereco', rotulo: 'Endereço' },
  { id: 'frete', rotulo: 'Frete' },
  { id: 'pagamento', rotulo: 'Pagamento' },
  { id: 'revisao', rotulo: 'Revisão' },
];

const MAX_PARCELAS = 6;

/** Bandeiras aceitas — exibidas como selo com o nome, não os logos oficiais (marcas registradas). */
const BANDEIRAS_ACEITAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Diners'];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent {
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly pedidoService = inject(PedidoService);
  private readonly freteService = inject(FreteService);
  private readonly router = inject(Router);

  readonly itens = this.carrinhoService.itensCarrinho;
  readonly subtotal = this.carrinhoService.valorTotal;

  readonly etapas = ETAPAS;

  readonly etapaAtual = signal<EtapaCheckout>('contato');
  readonly indiceEtapaAtual = computed(() =>
    this.etapas.findIndex((etapa) => etapa.id === this.etapaAtual())
  );

  // Passo 4 — dados de contato
  readonly nome = signal('');
  readonly email = signal('');
  readonly telefone = signal('');
  /** CPF ou CNPJ — exigido pelo Melhor Envio como documento do destinatário na compra da
   * etiqueta (fora daqui, não é usado pra nada no checkout em si). */
  readonly documento = signal('');
  readonly contatoValido = computed(
    () =>
      this.nome().trim().length > 1 &&
      /\S+@\S+\.\S+/.test(this.email()) &&
      this.telefone().replace(/\D/g, '').length >= 8 &&
      [11, 14].includes(this.documento().replace(/\D/g, '').length)
  );

  // Passo 5 — endereço de entrega
  readonly endereco = signal('');
  readonly numero = signal('');
  readonly bairro = signal('');
  readonly cidade = signal('');
  readonly uf = signal('');
  readonly cep = signal('');
  readonly enderecoValido = computed(() =>
    [this.endereco(), this.numero(), this.cidade(), this.uf(), this.cep()].every(
      (valor) => valor.trim().length > 0
    )
  );

  // Passo 6 — frete: cotação real via Melhor Envio (Edge Function `melhor-envio-cotar`),
  // disparada ao avançar do endereço pro frete — nunca chamamos a API deles direto daqui.
  readonly opcoesFrete = signal<OpcaoFrete[]>([]);
  readonly carregandoFrete = signal(false);
  readonly erroFrete = signal<string | null>(null);
  readonly freteSelecionadoId = signal<string | null>(null);
  readonly freteSelecionado = computed(
    () => this.opcoesFrete().find((opcao) => opcao.id === this.freteSelecionadoId()) ?? null
  );

  // Passo 7 — pagamento (integração real de cobrança fica pra depois — hoje é só simulação visual)
  readonly formaPagamento = signal<'cartao' | 'pix'>('pix');
  readonly bandeirasAceitas = BANDEIRAS_ACEITAS;

  readonly numeroCartao = signal('');
  readonly nomeCartao = signal('');
  readonly validadeCartao = signal('');
  readonly cvvCartao = signal('');
  readonly cpfCnpjCartao = signal('');
  readonly parcelas = signal(1);
  readonly salvarCartao = signal(false);

  readonly opcoesParcelas = computed(() => {
    const total = this.valorTotal();
    return Array.from({ length: MAX_PARCELAS }, (_, indice) => {
      const numero = indice + 1;
      return { numero, valorParcela: total / numero };
    });
  });

  readonly pagamentoValido = computed(() => {
    if (this.formaPagamento() !== 'cartao') return true;
    return (
      this.numeroCartao().replace(/\D/g, '').length >= 12 &&
      this.nomeCartao().trim().length > 1 &&
      /^\d{2}\/\d{2}$/.test(this.validadeCartao().trim()) &&
      /^\d{3,4}$/.test(this.cvvCartao().trim()) &&
      this.cpfCnpjCartao().replace(/\D/g, '').length >= 11
    );
  });

  private readonly ROTULOS_PAGAMENTO: Record<'cartao' | 'pix', string> = {
    pix: 'Pix',
    cartao: 'Cartão de crédito',
  };
  readonly formaPagamentoRotulo = computed(() => this.ROTULOS_PAGAMENTO[this.formaPagamento()]);

  readonly numeroCartaoMascarado = computed(() => {
    const digitos = this.numeroCartao().replace(/\D/g, '');
    return digitos.length >= 4 ? `•••• ${digitos.slice(-4)}` : '';
  });

  readonly valorFrete = computed(() => this.freteSelecionado()?.preco ?? 0);
  readonly valorTotal = computed(() => this.subtotal() + this.valorFrete());

  readonly pedidoFinalizado = signal(false);
  readonly numeroPedido = signal('');
  readonly finalizandoPedido = signal(false);
  readonly erroFinalizacao = signal<string | null>(null);

  atualizarNome(valor: string): void {
    this.nome.set(valor);
  }

  atualizarEmail(valor: string): void {
    this.email.set(valor);
  }

  atualizarTelefone(valor: string): void {
    this.telefone.set(valor);
  }

  atualizarDocumento(valor: string): void {
    this.documento.set(valor);
  }

  atualizarEndereco(valor: string): void {
    this.endereco.set(valor);
  }

  atualizarNumero(valor: string): void {
    this.numero.set(valor);
  }

  atualizarBairro(valor: string): void {
    this.bairro.set(valor);
  }

  atualizarCidade(valor: string): void {
    this.cidade.set(valor);
  }

  atualizarUf(valor: string): void {
    this.uf.set(valor.toUpperCase().slice(0, 2));
  }

  atualizarCep(valor: string): void {
    this.cep.set(valor);
  }

  atualizarNumeroCartao(valor: string): void {
    this.numeroCartao.set(valor);
  }

  atualizarNomeCartao(valor: string): void {
    this.nomeCartao.set(valor);
  }

  atualizarValidadeCartao(valor: string): void {
    this.validadeCartao.set(valor);
  }

  atualizarCvvCartao(valor: string): void {
    this.cvvCartao.set(valor);
  }

  atualizarCpfCnpjCartao(valor: string): void {
    this.cpfCnpjCartao.set(valor);
  }

  atualizarParcelas(valor: string): void {
    this.parcelas.set(Number(valor));
  }

  alternarSalvarCartao(valor: boolean): void {
    this.salvarCartao.set(valor);
  }

  selecionarFrete(id: string): void {
    this.freteSelecionadoId.set(id);
  }

  selecionarFormaPagamento(forma: 'cartao' | 'pix'): void {
    this.formaPagamento.set(forma);
  }

  /** Etapa é considerada concluída quando seus dados obrigatórios já foram preenchidos —
   * usado pra liberar navegação de volta e mostrar o indicador de progresso. */
  etapaConcluida(etapa: EtapaCheckout): boolean {
    switch (etapa) {
      case 'contato':
        return this.contatoValido();
      case 'endereco':
        return this.enderecoValido();
      case 'frete':
        return this.freteSelecionado() !== null;
      case 'pagamento':
        return this.pagamentoValido();
      case 'revisao':
        return false;
    }
  }

  podeAvancar(): boolean {
    return this.etapaConcluida(this.etapaAtual());
  }

  avancar(): void {
    if (!this.podeAvancar()) return;
    const proximoIndice = this.indiceEtapaAtual() + 1;
    if (proximoIndice < this.etapas.length) {
      const proximaEtapa = this.etapas[proximoIndice].id;
      this.etapaAtual.set(proximaEtapa);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (proximaEtapa === 'frete') {
        this.cotarFrete();
      }
    }
  }

  /** Cotação real de frete — busca as opções assim que o cliente chega na etapa de frete,
   * usando o CEP já informado e os itens do carrinho (peso/dimensões vêm do produto). */
  cotarFrete(): void {
    this.carregandoFrete.set(true);
    this.erroFrete.set(null);
    this.freteSelecionadoId.set(null);
    this.opcoesFrete.set([]);

    const itensParaCotacao = this.itens().map((item) => ({
      produtoId: item.produto.id,
      quantidade: item.quantidade,
    }));

    this.freteService.cotar(this.cep(), itensParaCotacao).subscribe({
      next: (opcoes) => {
        this.opcoesFrete.set(opcoes);
        this.carregandoFrete.set(false);
        if (opcoes.length === 0) {
          this.erroFrete.set('Nenhuma opção de frete disponível para esse endereço.');
        }
      },
      error: () => {
        this.carregandoFrete.set(false);
        this.erroFrete.set('Não foi possível calcular o frete. Tente novamente.');
      },
    });
  }

  voltar(): void {
    const indiceAnterior = this.indiceEtapaAtual() - 1;
    if (indiceAnterior >= 0) {
      this.etapaAtual.set(this.etapas[indiceAnterior].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Só permite pular direto pra uma etapa já visitada/concluída, nunca pular à frente. */
  irParaEtapa(etapa: EtapaCheckout): void {
    const indiceAlvo = this.etapas.findIndex((item) => item.id === etapa);
    if (indiceAlvo <= this.indiceEtapaAtual()) {
      this.etapaAtual.set(etapa);
    }
  }

  finalizarPedido(): void {
    this.finalizandoPedido.set(true);
    this.erroFinalizacao.set(null);

    const itensPedido: ItemPedido[] = this.itens().map((item) => ({
      produtoNome: item.produto.nome,
      produtoSlug: item.produto.slug,
      imagem: imagemDaVariante(item.produto, item.variante),
      tamanho: item.variante.tamanho,
      cor: item.variante.cor,
      quantidade: item.quantidade,
      precoUnitario: item.variante.precoOverride ?? item.produto.precoBase,
    }));

    this.pedidoService
      .criarPedido({
        nomeCliente: this.nome(),
        emailCliente: this.email(),
        telefoneCliente: this.telefone(),
        documentoCliente: this.documento(),
        endereco: {
          endereco: this.endereco(),
          numero: this.numero(),
          bairro: this.bairro(),
          cidade: this.cidade(),
          uf: this.uf(),
          cep: this.cep(),
        },
        itens: itensPedido,
        formaPagamento: this.formaPagamento(),
        parcelas: this.formaPagamento() === 'cartao' ? this.parcelas() : 1,
        valorFrete: this.valorFrete(),
        valorTotal: this.valorTotal(),
        freteServicoId: this.freteSelecionado()?.id,
        freteTransportadora: this.freteSelecionado()?.transportadora,
        freteServicoNome: this.freteSelecionado()?.servico,
        fretePrazoDias: this.freteSelecionado()?.prazoDias,
      })
      .subscribe({
        next: (pedido) => {
          this.numeroPedido.set(pedido.codigo);
          this.pedidoFinalizado.set(true);
          this.finalizandoPedido.set(false);
          this.carrinhoService.limparCarrinho();
        },
        error: () => {
          this.finalizandoPedido.set(false);
          this.erroFinalizacao.set(
            'Houve um problema ao registrar seu pedido. Tente novamente em instantes.'
          );
        },
      });
  }

  voltarParaHome(): void {
    this.router.navigate(['/']);
  }
}
