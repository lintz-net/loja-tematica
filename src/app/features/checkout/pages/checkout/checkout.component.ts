import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { MercadoPagoSdkService } from '../../../../core/servicos/mercado-pago-sdk.service';
import { FreteService, OpcaoFrete } from '../../../../core/servicos/frete.service';
import { CepService } from '../../../../core/servicos/cep.service';
import { CupomService, CupomValido } from '../../../../core/servicos/cupom.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { ItemPedido, Pedido } from '../../../../core/modelos/pedido.model';
import { imagemDaVariante } from '../../../../core/utilitarios/imagem-produto.util';
import {
  mascararCep,
  mascararCvv,
  mascararDocumento,
  mascararNumeroCartao,
  mascararTelefone,
  mascararValidadeCartao,
} from '../../../../core/utilitarios/mascara.util';
import {
  validarDocumento,
  validarNumeroCartao,
  validarValidadeCartao,
} from '../../../../core/utilitarios/validacao.util';
import { normalizarTexto } from '../../../../core/utilitarios/texto.util';
import { LOGOS_CARTAO } from '../../../../shared/dados/logos-pagamento';
import { obterLogoTransportadora } from '../../../../shared/dados/logos-transportadora';

/** Id sintético usado quando a entrega é presencial/grátis (cidade configurada em
 * /admin/config) — nunca enviado como `freteServicoId` do pedido, pra admin não tentar
 * comprar etiqueta do Melhor Envio pra essa opção (ver `podeComprarEtiqueta`). */
const ID_FRETE_LOCAL = 'entrega-local';

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

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnDestroy {
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly pedidoService = inject(PedidoService);
  private readonly freteService = inject(FreteService);
  private readonly cepService = inject(CepService);
  private readonly cupomService = inject(CupomService);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);
  private readonly mercadoPagoSdk = inject(MercadoPagoSdkService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Retomada de pagamento de um pedido já criado (Pix falhou/expirou) — chegou aqui via
   * /checkout/:codigoRetomada (link de "Tentar novamente"). Pula direto pra etapa de revisão
   * em modo leitura (sem stepper, sem "Editar"): o pedido já existe no banco, então o botão
   * final chama só `tentarNovamente()` (gera Pix de novo pro MESMO pedido), nunca
   * `finalizarPedido()` — que criaria um pedido novo vazio, já que o carrinho real está
   * vazio nesse fluxo. */
  readonly modoRetomada = signal(false);
  readonly carregandoRetomada = signal(false);
  readonly pedidoRetomado = signal<Pedido | null>(null);

  readonly itens = this.carrinhoService.itensCarrinho;

  private readonly subtotalRetomada = computed(() => {
    const pedido = this.pedidoRetomado();
    if (!pedido) return 0;
    return pedido.valorTotal - pedido.valorFrete + (pedido.valorDesconto ?? 0);
  });

  readonly subtotal = computed(() =>
    this.modoRetomada() ? this.subtotalRetomada() : this.carrinhoService.valorTotal()
  );

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
  readonly documentoTocado = signal(false);
  readonly erroDocumento = computed(() => {
    if (!this.documentoTocado()) return null;
    if (!this.documento().trim()) return 'Informe o CPF ou CNPJ.';
    return validarDocumento(this.documento()) ? null : 'CPF/CNPJ inválido — confira os dígitos.';
  });
  readonly contatoValido = computed(
    () =>
      this.nome().trim().length > 1 &&
      /\S+@\S+\.\S+/.test(this.email()) &&
      this.telefone().replace(/\D/g, '').length >= 8 &&
      validarDocumento(this.documento())
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

  /** Cidade/UF do endereço bate com a lista configurada em /admin/config? Comparação
   * normalizada (sem acento/caixa) pra não falhar por diferença de digitação entre o que o
   * ViaCEP devolve e o que o admin cadastrou. */
  readonly entregaLocalGratis = computed(() => {
    const cidades = this.configuracaoLojaService.configuracao()?.cidadesFreteGratis ?? [];
    const cidadeAtual = normalizarTexto(this.cidade());
    const ufAtual = normalizarTexto(this.uf());
    return cidades.some(
      (item) => normalizarTexto(item.cidade) === cidadeAtual && normalizarTexto(item.uf) === ufAtual
    );
  });

  // Passo 6 — frete: cotação real via Melhor Envio (Edge Function `melhor-envio-cotar`),
  // disparada ao avançar do endereço pro frete — nunca chamamos a API deles direto daqui.
  readonly opcoesFrete = signal<OpcaoFrete[]>([]);
  readonly carregandoFrete = signal(false);
  readonly erroFrete = signal<string | null>(null);
  readonly freteSelecionadoId = signal<string | null>(null);
  readonly freteSelecionado = computed(
    () => this.opcoesFrete().find((opcao) => opcao.id === this.freteSelecionadoId()) ?? null
  );

  // Passo 7 — pagamento. Cartão cobra de verdade via SDK.js do Mercado Pago (tokenização no
  // navegador — número/CVV nunca chegam no nosso backend), só à vista por enquanto
  // (parcelamento fica pra uma próxima etapa, ver TODO.md).
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

  // "Tocado" (blur) por campo — mensagem de erro só aparece depois que o cliente saiu do
  // campo, nunca enquanto ele ainda está no meio de digitar (senão fica irritante).
  readonly numeroCartaoTocado = signal(false);
  readonly nomeCartaoTocado = signal(false);
  readonly validadeCartaoTocada = signal(false);
  readonly cvvCartaoTocado = signal(false);
  readonly cpfCnpjCartaoTocado = signal(false);

  readonly erroNumeroCartao = computed(() => {
    if (!this.numeroCartaoTocado()) return null;
    if (!this.numeroCartao().trim()) return 'Informe o número do cartão.';
    return validarNumeroCartao(this.numeroCartao()) ? null : 'Número de cartão inválido — confira os dígitos.';
  });

  readonly erroNomeCartao = computed(() => {
    if (!this.nomeCartaoTocado()) return null;
    return this.nomeCartao().trim().length > 1 ? null : 'Informe o nome impresso no cartão.';
  });

  readonly erroValidadeCartao = computed(() => {
    if (!this.validadeCartaoTocada()) return null;
    const valor = this.validadeCartao().trim();
    if (!valor) return 'Informe a validade.';
    if (!/^\d{2}\/\d{2}$/.test(valor)) return 'Validade incompleta (MM/AA).';
    return validarValidadeCartao(valor) ? null : 'Cartão vencido ou validade inválida.';
  });

  readonly erroCvvCartao = computed(() => {
    if (!this.cvvCartaoTocado()) return null;
    const valor = this.cvvCartao().trim();
    if (!valor) return 'Informe o CVV.';
    return /^\d{3,4}$/.test(valor) ? null : 'CVV inválido.';
  });

  readonly erroCpfCnpjCartao = computed(() => {
    if (!this.cpfCnpjCartaoTocado()) return null;
    if (!this.cpfCnpjCartao().trim()) return 'Informe o CPF ou CNPJ do portador.';
    return validarDocumento(this.cpfCnpjCartao()) ? null : 'CPF/CNPJ inválido — confira os dígitos.';
  });

  /** Validação de verdade, não só formato: Luhn no número do cartão, MM/AA não vencido, e
   * dígito verificador real do CPF/CNPJ (ver validacao.util.ts) — pega erro de digitação que
   * só checar tamanho/regex deixaria passar até chegar na recusa do Mercado Pago. */
  readonly pagamentoValido = computed(() => {
    if (this.formaPagamento() !== 'cartao') return true;
    return (
      validarNumeroCartao(this.numeroCartao()) &&
      this.nomeCartao().trim().length > 1 &&
      validarValidadeCartao(this.validadeCartao()) &&
      /^\d{3,4}$/.test(this.cvvCartao().trim()) &&
      validarDocumento(this.cpfCnpjCartao())
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
  readonly valorDesconto = computed(() =>
    this.modoRetomada()
      ? (this.pedidoRetomado()?.valorDesconto ?? 0)
      : (this.cupomAplicado()?.desconto ?? 0)
  );

  readonly valorTotal = computed(() =>
    Math.max(0, this.subtotal() + this.valorFrete() - this.valorDesconto())
  );

  readonly pedidoFinalizado = signal(false);
  readonly numeroPedido = signal('');
  // Carrinho é limpo assim que o pedido é criado — depois disso `valorTotal()` (derivado do
  // carrinho) recalcularia pra 0, então o valor do pedido finalizado fica guardado aqui.
  readonly valorTotalFinalizado = signal(0);
  readonly finalizandoPedido = signal(false);
  readonly erroFinalizacao = signal<string | null>(null);

  // Pagamento Pix real (Mercado Pago) — QR code exibido enquanto aguardamos a confirmação,
  // que chega via webhook e é lida aqui por polling em `obter_pedido_por_codigo`.
  readonly aguardandoPix = signal(false);
  readonly pixQrCode = signal<string | null>(null);
  readonly pixQrCodeBase64 = signal<string | null>(null);
  readonly pixCodigoCopiado = signal(false);
  readonly statusPagamentoPix = signal<'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'expirado'>(
    'pendente'
  );
  private polling: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Observable, não snapshot: se o usuário navegar de /checkout/A pra /checkout/B sem
    // reload de página inteira (mesma config de rota, só o parâmetro muda), o Angular Router
    // reaproveita esta MESMA instância do componente — um snapshot lido só na construção
    // ficaria travado no pedido errado (o primeiro que carregou). takeUntilDestroyed evita
    // vazar a subscription quando o componente for destruído de verdade.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const codigoRetomada = params.get('codigoRetomada');
      if (codigoRetomada) {
        this.iniciarRetomada(codigoRetomada);
      }
    });
  }

  private iniciarRetomada(codigoRetomada: string): void {
    this.modoRetomada.set(true);
    this.carregandoRetomada.set(true);
    this.pararPolling(); // corta polling de uma retomada anterior, se a instância foi reaproveitada

    this.pedidoService.obterPorCodigo(codigoRetomada).subscribe({
      next: (pedido) => {
        // Nada pra retomar: pedido não existe, já foi pago/cancelado, ou é de cartão (só Pix
        // tem esse fluxo hoje) — manda pra tela de acompanhamento em vez de mostrar um
        // formulário de pagamento que não serve pra nada nesses casos.
        const podeRetomar =
          pedido &&
          pedido.formaPagamento === 'pix' &&
          (pedido.statusPagamento === 'pendente' || pedido.statusPagamento === 'recusado');

        if (!podeRetomar) {
          this.router.navigate(['/pedido', codigoRetomada]);
          return;
        }

        this.pedidoRetomado.set(pedido);
        this.numeroPedido.set(pedido.codigo);
        this.valorTotalFinalizado.set(pedido.valorTotal);

        this.nome.set(pedido.nomeCliente);
        this.email.set(pedido.emailCliente);
        this.telefone.set(pedido.telefoneCliente);
        this.documento.set(pedido.documentoCliente ?? '');
        this.endereco.set(pedido.endereco.endereco);
        this.numero.set(pedido.endereco.numero);
        this.complemento.set(pedido.endereco.complemento ?? '');
        this.bairro.set(pedido.endereco.bairro);
        this.cidade.set(pedido.endereco.cidade);
        this.uf.set(pedido.endereco.uf);
        this.cep.set(pedido.endereco.cep);
        this.formaPagamento.set('pix');

        // Sintetiza uma única "opção de frete" com os dados já gravados no pedido — assim o
        // computed `freteSelecionado`/`valorFrete` (e o bloco de revisão, sem edição nenhuma
        // aqui) resolvem sozinhos, sem precisar de uma cotação nova nem de duplicar template.
        // Sem transportadora/serviço (ex.: entrega local grátis, sem freteServicoId salvo) —
        // rótulo genérico em vez de mostrar um "—" solto dos dois lados.
        this.opcoesFrete.set([
          {
            id: 'retomada',
            nome:
              pedido.freteTransportadora && pedido.freteServicoNome
                ? `${pedido.freteTransportadora} — ${pedido.freteServicoNome}`
                : 'Entrega combinada',
            prazo: pedido.fretePrazoDias ? `${pedido.fretePrazoDias} dias úteis` : '',
            preco: pedido.valorFrete,
            transportadora: pedido.freteTransportadora ?? '',
            servico: pedido.freteServicoNome ?? '',
            prazoDias: pedido.fretePrazoDias ?? 0,
          },
        ]);
        this.freteSelecionadoId.set('retomada');

        this.etapaAtual.set('revisao');
        this.carregandoRetomada.set(false);

        // O pagamento pode ter sido aprovado (ou recusado de novo) por trás enquanto o
        // cliente só estava olhando esta tela, antes de clicar em "Pagar agora" — sem isso,
        // um "aprovado" silencioso deixaria a tela presa na revisão pedindo pra pagar de novo
        // um pedido que já foi pago. iniciarPollingPagamento já lida com o caso 'aprovado'
        // (troca pra tela de sucesso sozinha); outros status só param o polling, mesma
        // limitação que a tela de "aguardando Pix" normal já tem.
        this.iniciarPollingPagamento(pedido.codigo);
      },
      error: () => this.router.navigate(['/pedido', codigoRetomada]),
    });
  }

  /** Bloqueia letra/símbolo já na digitação, pros campos numéricos (CEP, telefone, CPF/CNPJ,
   * cartão) — a máscara já limpa o que não é dígito ao processar o valor, mas isso só
   * acontece DEPOIS do caractere entrar no campo; bloquear no keydown evita a letra aparecer
   * e sumir na hora seguinte, mais sólido visualmente. Deixa passar teclas de controle
   * (Backspace, setas, Tab, Ctrl+C/V etc.) — só barra caractere de verdade que não é dígito. */
  bloquearNaoNumerico(evento: KeyboardEvent): void {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.key.length > 1) return; // teclas de controle (Backspace, ArrowLeft, Tab...)
    if (!/\d/.test(evento.key)) evento.preventDefault();
  }

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
    this.numeroCartao.set(mascararNumeroCartao(valor));
  }

  atualizarNomeCartao(valor: string): void {
    // Maiúsculas porque é assim que o cartão vem impresso, e é o que o Mercado Pago espera
    // no cardholderName — evita rejeição silenciosa por diferença de caixa.
    this.nomeCartao.set(valor.toUpperCase());
  }

  atualizarValidadeCartao(valor: string): void {
    this.validadeCartao.set(mascararValidadeCartao(valor));
  }

  atualizarCvvCartao(valor: string): void {
    this.cvvCartao.set(mascararCvv(valor));
  }

  atualizarCpfCnpjCartao(valor: string): void {
    this.cpfCnpjCartao.set(mascararDocumento(valor));
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
   * usando o CEP já informado e os itens do carrinho (peso/dimensões vêm do produto). Pulada
   * por completo quando a cidade tem entrega/retirada presencial configurada em
   * /admin/config — nesse caso a única opção é frete grátis, sem chamar o Melhor Envio. */
  cotarFrete(): void {
    this.erroFrete.set(null);
    this.freteSelecionadoId.set(null);

    if (this.entregaLocalGratis()) {
      this.carregandoFrete.set(false);
      const opcaoLocal: OpcaoFrete = {
        id: ID_FRETE_LOCAL,
        nome: 'Entrega/retirada combinada com a loja',
        prazo: 'A combinar',
        preco: 0,
        transportadora: 'Entrega local',
        servico: 'Grátis',
        prazoDias: 0,
      };
      this.opcoesFrete.set([opcaoLocal]);
      this.freteSelecionadoId.set(ID_FRETE_LOCAL);
      return;
    }

    this.carregandoFrete.set(true);
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

    // Capturado antes de limpar o carrinho — depois disso `this.valorTotal()` (derivado do
    // carrinho) recalcularia pra 0, o que já quebrou a criação do Pix (valor não positivo).
    const valorTotalPedido = this.valorTotal();

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
        valorTotal: valorTotalPedido,
        // Sem freteServicoId pra entrega local — não é um serviço real do Melhor Envio, não
        // há etiqueta pra comprar (ver podeComprarEtiqueta em admin-pedidos.component.ts).
        freteServicoId:
          this.freteSelecionado()?.id === ID_FRETE_LOCAL ? undefined : this.freteSelecionado()?.id,
        freteTransportadora: this.freteSelecionado()?.transportadora,
        freteServicoNome: this.freteSelecionado()?.servico,
        fretePrazoDias: this.freteSelecionado()?.prazoDias,
        cupomCodigo: this.cupomAplicado()?.codigo,
        valorDesconto: this.valorDesconto() > 0 ? this.valorDesconto() : undefined,
      })
      .subscribe({
        next: (pedido) => {
          this.numeroPedido.set(pedido.codigo);
          this.valorTotalFinalizado.set(valorTotalPedido);
          this.carrinhoService.limparCarrinho();

          if (this.formaPagamento() === 'pix') {
            this.gerarPagamentoPix(pedido.codigo, valorTotalPedido);
            return;
          }

          this.pagarComCartao(pedido.codigo, valorTotalPedido);
        },
        error: () => {
          this.finalizandoPedido.set(false);
          this.erroFinalizacao.set(
            'Houve um problema ao registrar seu pedido. Tente novamente em instantes.'
          );
        },
      });
  }

  /** Gera a cobrança Pix pro pedido recém-criado e começa a aguardar a confirmação. Se a
   * geração falhar, o pedido continua registrado (status_pagamento 'pendente') — o cliente
   * pode tentar de novo pela tela de acompanhamento, então aqui só mostramos o erro. */
  private gerarPagamentoPix(codigoPedido: string, valorTotal: number): void {
    this.pedidoService
      .criarPagamentoPix({
        codigoPedido,
        valorTotal,
        emailCliente: this.email(),
        nomeCliente: this.nome(),
        documentoCliente: this.documento(),
      })
      .subscribe({
        next: (pagamento) => {
          this.pixQrCode.set(pagamento.qrCode);
          this.pixQrCodeBase64.set(pagamento.qrCodeBase64);
          this.finalizandoPedido.set(false);
          this.aguardandoPix.set(true);
          this.iniciarPollingPagamento(codigoPedido);
        },
        error: () => {
          this.finalizandoPedido.set(false);
          this.erroFinalizacao.set(
            'Pedido registrado, mas não foi possível gerar o Pix agora. Clique em "Tentar novamente" pra gerar o Pix desse mesmo pedido.'
          );
        },
      });
  }

  /** Botão "Tentar novamente" da tela de erro — se o pedido já foi criado (só o pagamento
   * falhou), tenta cobrar de novo o MESMO pedido, sem recriar nada. O carrinho já foi limpo
   * nesse ponto, então chamar finalizarPedido() de novo criaria um pedido vazio. Só cai em
   * finalizarPedido() quando o pedido em si não chegou a ser criado. Cartão gera um token
   * novo a cada tentativa (o token é de uso único) — os campos continuam preenchidos com o
   * que o cliente digitou, ele só precisa corrigir o que causou a recusa e tentar de novo. */
  tentarNovamente(): void {
    if (this.numeroPedido()) {
      this.erroFinalizacao.set(null);
      this.finalizandoPedido.set(true);
      if (this.formaPagamento() === 'cartao') {
        this.pagarComCartao(this.numeroPedido(), this.valorTotalFinalizado());
      } else {
        this.gerarPagamentoPix(this.numeroPedido(), this.valorTotalFinalizado());
      }
      return;
    }
    this.finalizarPedido();
  }

  /** Tokeniza o cartão via SDK.js do Mercado Pago (número/CVV nunca chegam no nosso
   * backend, só o token de uso único) e cobra o pedido já criado. Diferente do Pix, a
   * resposta já vem com o status final na hora — 'approved' fecha o pedido, qualquer outro
   * status vira erro com convite pra tentar de novo (cartão diferente, ou corrigir os dados). */
  private async pagarComCartao(codigoPedido: string, valorTotal: number): Promise<void> {
    try {
      const mp = await this.mercadoPagoSdk.carregar();
      const numeroLimpo = this.numeroCartao().replace(/\D/g, '');
      const bin = numeroLimpo.slice(0, 6);

      const metodos = await mp.getPaymentMethods({ bin });
      const paymentMethodId = metodos.results[0]?.id;
      if (!paymentMethodId) {
        throw new Error('Não reconhecemos a bandeira desse cartão.');
      }

      const issuers = await mp.getIssuers({ paymentMethodId, bin });
      const issuerId = issuers[0]?.id;

      const [mes, ano] = this.validadeCartao().trim().split('/');
      const documentoLimpo = this.cpfCnpjCartao().replace(/\D/g, '');

      const token = await mp.createCardToken({
        cardNumber: numeroLimpo,
        cardholderName: this.nomeCartao().trim(),
        cardExpirationMonth: mes,
        cardExpirationYear: `20${ano}`,
        securityCode: this.cvvCartao().trim(),
        identificationType: documentoLimpo.length === 14 ? 'CNPJ' : 'CPF',
        identificationNumber: documentoLimpo,
      });

      const pagamento = await firstValueFrom(
        this.pedidoService.criarPagamentoCartao({
          codigoPedido,
          valorTotal,
          emailCliente: this.email(),
          nomeCliente: this.nome(),
          documentoCliente: this.documento(),
          token: token.id,
          paymentMethodId,
          issuerId,
        })
      );

      this.finalizandoPedido.set(false);

      if (pagamento.status === 'approved') {
        this.pedidoFinalizado.set(true);
        return;
      }

      this.erroFinalizacao.set(
        pagamento.status === 'rejected'
          ? 'Pagamento recusado pelo cartão. Confira os dados ou tente outro cartão.'
          : 'Pagamento em análise pela operadora do cartão. Clique em "Tentar novamente" em alguns instantes, ou acompanhe o pedido.'
      );
    } catch (erro) {
      console.error('Falha ao processar pagamento por cartão:', erro);
      this.finalizandoPedido.set(false);
      this.erroFinalizacao.set(
        'Não foi possível processar o cartão. Confira o número, validade e CVV, e tente de novo.'
      );
    }
  }

  private iniciarPollingPagamento(codigoPedido: string): void {
    this.pararPolling();
    this.polling = setInterval(() => {
      this.pedidoService.obterPorCodigo(codigoPedido).subscribe((pedido) => {
        const status = pedido?.statusPagamento;
        if (!status || status === 'pendente') return;

        this.statusPagamentoPix.set(status);
        this.pararPolling();

        if (status === 'aprovado') {
          this.aguardandoPix.set(false);
          this.pedidoFinalizado.set(true);
        }
      });
    }, 4000);
  }

  private pararPolling(): void {
    if (this.polling !== null) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }

  copiarCodigoPix(): void {
    const codigo = this.pixQrCode();
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      this.pixCodigoCopiado.set(true);
      setTimeout(() => this.pixCodigoCopiado.set(false), 2000);
    });
  }

  ngOnDestroy(): void {
    this.pararPolling();
  }

  voltarParaHome(): void {
    this.router.navigate(['/']);
  }
}
