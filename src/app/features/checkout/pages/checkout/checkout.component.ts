import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { FreteService, OpcaoFrete } from '../../../../core/servicos/frete.service';
import { CepService } from '../../../../core/servicos/cep.service';
import { CupomService, CupomValido } from '../../../../core/servicos/cupom.service';
import { ItemPedido } from '../../../../core/modelos/pedido.model';
import { imagemDaVariante } from '../../../../core/utilitarios/imagem-produto.util';
import { mascararCep, mascararDocumento, mascararTelefone } from '../../../../core/utilitarios/mascara.util';
import { LOGOS_CARTAO } from '../../../../shared/dados/logos-pagamento';
import { obterLogoTransportadora } from '../../../../shared/dados/logos-transportadora';

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
  private readonly cepService = inject(CepService);
  private readonly cupomService = inject(CupomService);
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
  readonly complemento = signal('');
  readonly bairro = signal('');
  readonly cidade = signal('');
  readonly uf = signal('');
  readonly cep = signal('');
  readonly buscandoCep = signal(false);
  /** ViaCEP não é uma base completa — CEPs novos ou pouco comuns podem ser reais e mesmo
   * assim não estarem cadastrados lá. Por isso um CEP "não encontrado" só vira aviso forte
   * (`erroCep`), sem travar o avanço: bloquear na marra arriscava perder venda de cliente com
   * endereço válido só porque o ViaCEP não conhece aquele CEP específico. */
  readonly erroCep = signal<string | null>(null);
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
  readonly bandeirasAceitas = LOGOS_CARTAO;

  /** Nome da transportadora vem dinâmico da cotação do Melhor Envio — sem logo salvo pra
   * ela, a opção continua mostrando só o nome em texto (ver obterLogoTransportadora). */
  readonly obterLogoTransportadora = obterLogoTransportadora;

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

  // Cupom de desconto — validado no servidor (Edge Function `validar-cupom`), nunca calculado
  // só no navegador: a tabela de cupons não é legível pelo `anon`.
  readonly codigoCupom = signal('');
  readonly cupomAplicado = signal<CupomValido | null>(null);
  readonly validandoCupom = signal(false);
  readonly erroCupom = signal<string | null>(null);
  readonly valorDesconto = computed(() => this.cupomAplicado()?.desconto ?? 0);

  readonly valorTotal = computed(() =>
    Math.max(0, this.subtotal() + this.valorFrete() - this.valorDesconto())
  );

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
    this.telefone.set(mascararTelefone(valor));
  }

  atualizarDocumento(valor: string): void {
    this.documento.set(mascararDocumento(valor));
  }

  atualizarEndereco(valor: string): void {
    this.endereco.set(valor);
  }

  atualizarNumero(valor: string): void {
    this.numero.set(valor);
  }

  atualizarComplemento(valor: string): void {
    this.complemento.set(valor);
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
    const cepMascarado = mascararCep(valor);
    this.cep.set(cepMascarado);
    this.erroCep.set(null);

    if (cepMascarado.replace(/\D/g, '').length !== 8) return;

    this.buscandoCep.set(true);
    this.cepService.buscarEndereco(cepMascarado).subscribe({
      next: (endereco) => {
        this.buscandoCep.set(false);
        if (!endereco) {
          this.erroCep.set('CEP não encontrado — confira se digitou certo antes de continuar.');
          return;
        }
        this.endereco.set(endereco.endereco);
        this.bairro.set(endereco.bairro);
        this.cidade.set(endereco.cidade);
        this.uf.set(endereco.uf);
      },
      error: () => {
        this.buscandoCep.set(false);
        this.erroCep.set('Não foi possível buscar o CEP — preencha manualmente.');
      },
    });
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

  atualizarCodigoCupom(valor: string): void {
    this.codigoCupom.set(valor.toUpperCase());
    this.erroCupom.set(null);
  }

  aplicarCupom(): void {
    const codigo = this.codigoCupom().trim();
    if (!codigo) return;

    this.validandoCupom.set(true);
    this.erroCupom.set(null);
    this.cupomService.validar(codigo, this.subtotal()).subscribe({
      next: (resultado) => {
        this.validandoCupom.set(false);
        if (!resultado.valido) {
          this.erroCupom.set(resultado.motivo);
          this.cupomAplicado.set(null);
          return;
        }
        this.cupomAplicado.set(resultado);
      },
      error: () => {
        this.validandoCupom.set(false);
        this.erroCupom.set('Não foi possível validar o cupom. Tente novamente.');
      },
    });
  }

  removerCupom(): void {
    this.cupomAplicado.set(null);
    this.codigoCupom.set('');
    this.erroCupom.set(null);
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
          complemento: this.complemento() || undefined,
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
        cupomCodigo: this.cupomAplicado()?.codigo,
        valorDesconto: this.valorDesconto() > 0 ? this.valorDesconto() : undefined,
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
