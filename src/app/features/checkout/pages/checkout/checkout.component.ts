import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { ItemPedido } from '../../../../core/modelos/pedido.model';

type EtapaCheckout = 'contato' | 'endereco' | 'frete' | 'pagamento' | 'revisao';

interface DefinicaoEtapa {
  id: EtapaCheckout;
  rotulo: string;
}

interface OpcaoFrete {
  id: string;
  nome: string;
  prazo: string;
  preco: number;
}

const ETAPAS: DefinicaoEtapa[] = [
  { id: 'contato', rotulo: 'Contato' },
  { id: 'endereco', rotulo: 'Endereço' },
  { id: 'frete', rotulo: 'Frete' },
  { id: 'pagamento', rotulo: 'Pagamento' },
  { id: 'revisao', rotulo: 'Revisão' },
];

const OPCOES_FRETE: OpcaoFrete[] = [
  { id: 'economico', nome: 'Econômico', prazo: '7 a 10 dias úteis', preco: 14.9 },
  { id: 'padrao', nome: 'Padrão', prazo: '4 a 6 dias úteis', preco: 24.9 },
  { id: 'expresso', nome: 'Expresso', prazo: '1 a 2 dias úteis', preco: 39.9 },
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
  private readonly router = inject(Router);

  readonly itens = this.carrinhoService.itensCarrinho;
  readonly subtotal = this.carrinhoService.valorTotal;

  readonly etapas = ETAPAS;
  readonly opcoesFrete = OPCOES_FRETE;

  readonly etapaAtual = signal<EtapaCheckout>('contato');
  readonly indiceEtapaAtual = computed(() =>
    this.etapas.findIndex((etapa) => etapa.id === this.etapaAtual())
  );

  // Passo 4 — dados de contato
  readonly nome = signal('');
  readonly email = signal('');
  readonly telefone = signal('');
  readonly contatoValido = computed(
    () =>
      this.nome().trim().length > 1 &&
      /\S+@\S+\.\S+/.test(this.email()) &&
      this.telefone().replace(/\D/g, '').length >= 8
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

  // Passo 6 — frete
  readonly freteSelecionadoId = signal<string | null>(null);
  readonly freteSelecionado = computed(
    () => this.opcoesFrete.find((opcao) => opcao.id === this.freteSelecionadoId()) ?? null
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
      this.etapaAtual.set(this.etapas[proximoIndice].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
      imagem: item.produto.imagens[0] ?? '',
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
