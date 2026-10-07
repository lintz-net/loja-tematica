import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { CardForm, MercadoPagoSdkService } from '../../../../core/servicos/mercado-pago-sdk.service';
import { FreteService, OpcaoFrete } from '../../../../core/servicos/frete.service';
import { CepService } from '../../../../core/servicos/cep.service';
import { CupomService, CupomValido } from '../../../../core/servicos/cupom.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { ItemPedido, Pedido } from '../../../../core/modelos/pedido.model';
import { imagemDaVariante } from '../../../../core/utilitarios/imagem-produto.util';
import { mascararCep, mascararDocumento, mascararTelefone } from '../../../../core/utilitarios/mascara.util';
import { validarDocumento } from '../../../../core/utilitarios/validacao.util';
import { normalizarTexto } from '../../../../core/utilitarios/texto.util';
import { parcelasDisponiveis } from '../../../../core/constantes/parcelamento.constantes';
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
  imports: [RouterLink, NgTemplateOutlet],
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
  // navegador — número/CVV nunca chegam no nosso backend). Parcelamento sem juros: quem
  // divide o valor entre as parcelas é o próprio Mercado Pago (mesmo transaction_amount), a
  // loja só decide até quantas parcelas oferecer (ver parcelamento.constantes.ts).
  readonly formaPagamento = signal<'cartao' | 'pix' | 'manual'>('pix');

  /** "Combinar pagamento" só aparece quando o lojista habilita em `/admin/config` (padrão
   * desligado — ver ConfiguracaoLoja.aceitaPagamentoManual). */
  readonly aceitaPagamentoManual = computed(
    () => this.configuracaoLojaService.configuracao()?.aceitaPagamentoManual ?? false
  );
  readonly bandeirasAceitas = LOGOS_CARTAO;

  /** Nome da transportadora vem dinâmico da cotação do Melhor Envio — sem logo salvo pra
   * ela, a opção continua mostrando só o nome em texto (ver obterLogoTransportadora). */
  readonly obterLogoTransportadora = obterLogoTransportadora;

  readonly nomeCartao = signal('');
  readonly cpfCnpjCartao = signal('');
  readonly parcelas = signal(1);

  // "Tocado" (blur) por campo — mensagem de erro só aparece depois que o cliente saiu do
  // campo, nunca enquanto ele ainda está no meio de digitar (senão fica irritante).
  readonly nomeCartaoTocado = signal(false);
  readonly cpfCnpjCartaoTocado = signal(false);

  // Número/validade/CVV vivem dentro de iframes do Mercado Pago (Secure Fields — ver
  // mercado-pago-sdk.service.ts) e nunca tocam nosso HTML/JS, então não dá pra ler o valor
  // desses três campos aqui — mas dá pra saber se cada um está válido, via `onValidityChange`
  // (dispara conforme o cliente digita dentro do iframe, sem nunca expor o valor em si).
  // Começam todos `false`: sem isso, clicar em "Confirmar" com os campos vazios passava batido
  // (só travava depois, no timeout da tokenização) — ver TODO.md.
  readonly cardFormPronto = signal(false);
  readonly cardFormErro = signal<string | null>(null);
  readonly camposSeguroValidos = signal<Record<'cardNumber' | 'expirationDate' | 'securityCode', boolean>>(
    { cardNumber: false, expirationDate: false, securityCode: false }
  );
  private cardForm: CardForm | null = null;
  private resolverEnvioCardForm: (() => void) | null = null;

  readonly erroNomeCartao = computed(() => {
    if (!this.nomeCartaoTocado()) return null;
    return this.nomeCartao().trim().length > 1 ? null : 'Informe o nome impresso no cartão.';
  });

  readonly erroCpfCnpjCartao = computed(() => {
    if (!this.cpfCnpjCartaoTocado()) return null;
    if (!this.cpfCnpjCartao().trim()) return 'Informe o CPF ou CNPJ do portador.';
    return validarDocumento(this.cpfCnpjCartao()) ? null : 'CPF/CNPJ inválido — confira os dígitos.';
  });

  /** O <select> escondido `form-checkout__identificationType` (exigido pela SDK pra montar o
   * form) precisa refletir isso — ver template. */
  readonly tipoDocumentoCartao = computed(() =>
    this.cpfCnpjCartao().replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'
  );

  /** O input escondido `form-checkout__identificationNumber` (que a SDK lê de verdade) usa
   * isso — a API do Mercado Pago só aceita dígitos, o input visível pro cliente tem máscara
   * (pontos/traço) que ela rejeitaria com "invalid parameter identificationNumber". */
  readonly documentoCartaoDigitos = computed(() => this.cpfCnpjCartao().replace(/\D/g, ''));

  /** Número/validade/CVV são validados pela própria SDK dentro dos iframes (Secure Fields,
   * via `onValidityChange` — ver `camposSeguroValidos`) — aqui confere que o form foi montado,
   * que os três campos seguros estão válidos, e que nome/CPF-CNPJ (campos normais, fora do
   * iframe) estão preenchidos e válidos. Erro de recusa de verdade (cartão sem saldo etc.) só
   * aparece no momento de gerar o token/cobrar, não dá pra saber antes disso. */
  readonly pagamentoValido = computed(() => {
    if (this.formaPagamento() !== 'cartao') return true;
    const campos = this.camposSeguroValidos();
    return (
      this.cardFormPronto() &&
      campos.cardNumber &&
      campos.expirationDate &&
      campos.securityCode &&
      this.nomeCartao().trim().length > 1 &&
      validarDocumento(this.cpfCnpjCartao())
    );
  });

  private readonly ROTULOS_PAGAMENTO: Record<'cartao' | 'pix' | 'manual', string> = {
    pix: 'Pix',
    cartao: 'Cartão de crédito',
    manual: 'Combinar pagamento',
  };
  readonly formaPagamentoRotulo = computed(() => this.ROTULOS_PAGAMENTO[this.formaPagamento()]);

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

  /** Valor a usar no seletor de parcelas — depois que o pedido já foi criado (ex.: retry de
   * pagamento após erro), o carrinho já foi limpo e `valorTotal()` cairia pra 0; nesse caso usa
   * o valor já travado do pedido em vez do carrinho (que não reflete mais nada). */
  private readonly valorParaParcelas = computed(() =>
    this.numeroPedido() ? this.valorTotalFinalizado() : this.valorTotal()
  );

  /** Máximo de parcelas sem juros oferecido pro valor do pedido — cai conforme o total cai
   * (ex.: cupom aplicado), respeitando VALOR_MINIMO_PARCELA. */
  readonly quantidadeMaximaParcelas = computed(() => parcelasDisponiveis(this.valorParaParcelas()));

  /** Opções pro seletor de parcelas — sempre a partir de 1x, valor de cada parcela é só o
   * total dividido (sem juros: quem faz a divisão de verdade na cobrança é o Mercado Pago). */
  readonly opcoesParcelas = computed(() => {
    const total = this.valorParaParcelas();
    return Array.from({ length: this.quantidadeMaximaParcelas() }, (_, i) => i + 1).map(
      (numero) => ({ numero, valorParcela: total / numero })
    );
  });

  /** O que `parcelas()` guarda pode ficar desatualizado se o total cair depois da escolha
   * (ex.: cupom aplicado depois) — este é o valor de verdade a usar em qualquer lugar
   * (exibição, validação, envio pro pagamento). */
  readonly parcelaSelecionada = computed(() =>
    Math.min(this.parcelas(), this.quantidadeMaximaParcelas())
  );

  readonly pedidoFinalizado = signal(false);
  readonly numeroPedido = signal('');
  // Carrinho é limpo assim que o pedido é criado — depois disso `valorTotal()` (derivado do
  // carrinho) recalcularia pra 0, então o valor do pedido finalizado fica guardado aqui.
  readonly valorTotalFinalizado = signal(0);
  // Mesmo motivo do valorTotalFinalizado acima: valorTotal()=0 pós-limpeza faria
  // parcelaSelecionada() cair pra 1x mesmo que o cliente tenha escolhido mais parcelas.
  readonly parcelasFinalizadas = signal(1);
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
        // Nada pra retomar: pedido não existe, já foi pago/cancelado, ou é "Combinar
        // pagamento" (sem cobrança nenhuma no Mercado Pago pra gerar aqui) — manda pra tela de
        // acompanhamento em vez de mostrar um formulário de pagamento que não serve pra nada
        // nesses casos.
        const podeRetomar =
          pedido &&
          pedido.formaPagamento !== 'manual' &&
          (pedido.statusPagamento === 'pendente' || pedido.statusPagamento === 'recusado');

        if (!podeRetomar) {
          this.router.navigate(['/pedido', codigoRetomada]);
          return;
        }

        this.pedidoRetomado.set(pedido);
        this.numeroPedido.set(pedido.codigo);
        this.valorTotalFinalizado.set(pedido.valorTotal);
        this.parcelasFinalizadas.set(pedido.parcelas);

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
        this.formaPagamento.set(pedido.formaPagamento);
        if (pedido.formaPagamento === 'cartao') {
          this.mercadoPagoSdk.carregarScriptSeguranca();
        }

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

        if (pedido.formaPagamento === 'cartao') {
          this.montarCardForm(pedido.valorTotal);
        }

        // Polling de aprovação em background só faz sentido pro Pix (QR code pago por fora,
        // via webhook, enquanto o cliente pode estar só olhando esta tela sem interagir).
        // Cartão não tem esse risco: nada acontece até o cliente preencher os dados de novo
        // (token de uso único, sempre exige interação) e clicar em "Pagar agora".
        if (pedido.formaPagamento === 'pix') {
          // O pagamento pode ter sido aprovado (ou recusado de novo) por trás enquanto o
          // cliente só estava olhando esta tela, antes de clicar em "Pagar agora" — sem isso,
          // um "aprovado" silencioso deixaria a tela presa na revisão pedindo pra pagar de
          // novo um pedido que já foi pago. iniciarPollingPagamento já lida com o caso
          // 'aprovado' (troca pra tela de sucesso sozinha); outros status só param o
          // polling, mesma limitação que a tela de "aguardando Pix" normal já tem.
          this.iniciarPollingPagamento(pedido.codigo);
        }
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
    // Autopreenchimento do navegador dispara eventos sintéticos sem `key` (ex.: preenchimento
    // automático de CPF salvo) — sem essa guarda, o autofill quebrava com TypeError aqui.
    if (!evento.key) return;
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

  atualizarNomeCartao(valor: string): void {
    // Maiúsculas porque é assim que o cartão vem impresso, e é o que o Mercado Pago espera
    // no cardholderName — evita rejeição silenciosa por diferença de caixa.
    this.nomeCartao.set(valor.toUpperCase());
  }

  atualizarCpfCnpjCartao(valor: string): void {
    this.cpfCnpjCartao.set(mascararDocumento(valor));
  }

  atualizarParcelas(valor: string): void {
    this.parcelas.set(Number(valor) || 1);
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
    const itens = this.carrinhoService.itensCarrinho().map((item) => ({
      produtoId: item.produto.id,
      categorias: item.produto.categorias,
      precoUnitario: item.variante.precoOverride ?? item.produto.precoBase,
      quantidade: item.quantidade,
    }));
    this.cupomService.validar(codigo, itens, this.email().trim() || undefined).subscribe({
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

  selecionarFormaPagamento(forma: 'cartao' | 'pix' | 'manual'): void {
    this.formaPagamento.set(forma);
    // Carrega cedo (ao escolher cartão, não só no clique de pagar) pra dar tempo do
    // fingerprint ficar pronto antes da cobrança — fire-and-forget, nunca bloqueia nada. O
    // Secure Fields em si só monta na etapa "revisao" (ver avancar()) — é lá que o
    // `<form id="form-checkout">` de verdade existe no DOM, não aqui.
    if (forma === 'cartao') {
      this.mercadoPagoSdk.carregarScriptSeguranca();
    }
  }

  private async aguardarElemento(id: string, tentativas = 40): Promise<boolean> {
    for (let i = 0; i < tentativas; i++) {
      if (document.getElementById(id)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  /** Monta o Secure Fields (iframes de número/validade/CVV) — só pode ser chamado quando o
   * `<form id="form-checkout">` alvo (renderizado na etapa "revisao", ver
   * checkout.component.html) está de verdade no DOM. Só resolve depois que `onFormMounted`
   * (sucesso ou erro) dispara — quem chama precisa aguardar isso antes de deixar o cliente
   * pagar, senão os iframes podem não estar prontos pra digitar ainda. Chamado de novo em toda
   * (re)entrada na etapa "revisao" com cartão — inclusive no retry depois de um erro (a tela de
   * erro substitui a página inteira, o que desmonta os iframes anteriores junto). */
  private async montarCardForm(valorTotal: number): Promise<void> {
    try {
      this.cardForm?.unmount();
    } catch {
      // unmount() do SDK lança se o form anterior nunca chegou a montar de verdade — sem
      // problema, é só o cleanup de uma tentativa que já tinha falhado.
    }
    this.cardForm = null;
    this.cardFormPronto.set(false);
    this.cardFormErro.set(null);
    // Form remontado = iframes em branco de novo (token de uso único) — os campos seguros
    // precisam voltar a "inválido" até o cliente digitar de novo, senão o botão ficaria
    // destravado com a validade da montagem anterior.
    this.camposSeguroValidos.set({ cardNumber: false, expirationDate: false, securityCode: false });

    const elementoExiste = await this.aguardarElemento('form-checkout');
    if (!elementoExiste) {
      this.cardFormErro.set('Não foi possível carregar o formulário de cartão. Recarregue a página.');
      return;
    }

    try {
      const mp = await this.mercadoPagoSdk.carregar();

      // Se a SDK nunca chamar `onFormMounted` (falha de rede, travada em algum estado
      // interno), não pode deixar o cliente preso pra sempre num botão desabilitado sem
      // explicação — daí o timeout, cancelado assim que `onFormMounted` dispara de verdade
      // (nunca deixa os dois `resolve()` competindo soltos).
      await new Promise<void>((resolve) => {
        const temporizador = setTimeout(() => {
          if (!this.cardFormPronto()) {
            this.cardFormErro.set(
              'O formulário de cartão demorou demais pra carregar. Recarregue a página.'
            );
          }
          resolve();
        }, 8000);

        this.cardForm = mp.cardForm({
          amount: valorTotal.toFixed(2),
          iframe: true,
          form: {
            id: 'form-checkout',
            cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número do cartão' },
            expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/AA' },
            securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
            cardholderName: {
              id: 'form-checkout__cardholderName',
              placeholder: 'Nome impresso no cartão',
            },
            // Emissor e parcelas ficam escondidos (ver checkout.component.html) — a loja usa
            // o próprio seletor de parcelas (respeitando VALOR_MINIMO_PARCELA), não o da SDK.
            issuer: { id: 'form-checkout__issuer' },
            installments: { id: 'form-checkout__installments' },
            identificationType: { id: 'form-checkout__identificationType' },
            identificationNumber: { id: 'form-checkout__identificationNumber' },
            cardholderEmail: { id: 'form-checkout__cardholderEmail' },
          },
          callbacks: {
            onFormMounted: (erro) => {
              clearTimeout(temporizador);
              if (erro) {
                console.error('Falha ao montar o Secure Fields:', erro);
                this.cardFormErro.set(
                  'Não foi possível carregar o formulário de cartão. Recarregue a página.'
                );
              } else {
                this.cardFormPronto.set(true);
              }
              resolve();
            },
            // Dispara só depois que a SDK termina a tokenização assíncrona iniciada pelo
            // submit do <form id="form-checkout"> (ver pagarComCartao) — antes disso,
            // getCardFormData() não tem token nenhum pra devolver, mesmo com os campos
            // preenchidos.
            onSubmit: (evento) => {
              evento.preventDefault();
              this.resolverEnvioCardForm?.();
              this.resolverEnvioCardForm = null;
            },
            onError: (erro) => {
              console.error('Erro no Secure Fields:', erro);
            },
            // Dispara a cada tecla digitada em qualquer campo do form — inclusive os de
            // dentro dos iframes. Só atualiza o signal pros 3 campos seguros que a gente
            // acompanha (nome/CPF já têm validação própria, fora da SDK).
            onValidityChange: (erro, campo) => {
              if (campo === 'cardNumber' || campo === 'expirationDate' || campo === 'securityCode') {
                this.camposSeguroValidos.update((atual) => ({ ...atual, [campo]: !erro }));
              }
            },
          },
        });
      });
    } catch (erro) {
      console.error('Falha ao carregar a SDK do Mercado Pago:', erro);
      this.cardFormErro.set('Não foi possível carregar o formulário de cartão. Recarregue a página.');
    }
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
        // Escolher a forma de pagamento é suficiente pra avançar — o cartão em si (Secure
        // Fields) só é validado na etapa "revisao" (onde o formulário de verdade é montado e
        // o botão de confirmar já é bloqueado por pagamentoValido() até ele ficar pronto).
        return true;
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
      // O Secure Fields só pode montar quando o <form id="form-checkout"> de verdade existe
      // no DOM — na etapa "revisao" (não em "pagamento", que só escolhe Pix vs cartão), e só
      // pro fluxo normal: retomada já monta em iniciarRetomada().
      if (proximaEtapa === 'revisao' && this.formaPagamento() === 'cartao' && !this.modoRetomada()) {
        this.montarCardForm(this.valorTotal());
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
    const parcelasPedido = this.formaPagamento() === 'cartao' ? this.parcelaSelecionada() : 1;

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
        parcelas: parcelasPedido,
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
          this.parcelasFinalizadas.set(parcelasPedido);
          this.carrinhoService.limparCarrinho();

          if (this.formaPagamento() === 'manual') {
            this.registrarPedidoManual(pedido.codigo);
            return;
          }

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
        // Só true quando essa geração acontece dentro da retomada — ver comentário no corpo
        // da Edge Function (mercado-pago-criar-pagamento) sobre por que a idempotency key
        // muda nesse caso.
        retomada: this.modoRetomada(),
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

  /** "Combinar pagamento" — pedido já foi criado (sem passar pelo Mercado Pago), só falta
   * reservar o estoque (ver `registrar-pagamento-manual`, Edge Function — a role anon não
   * pode editar `produtos` direto). Se a reserva falhar, o pedido continua válido mesmo assim
   * (igual ao Pix: falha aqui não derruba o checkout) — o admin ainda confere/ajusta estoque
   * na mão como sempre fez antes dessa automação existir. */
  private registrarPedidoManual(codigoPedido: string): void {
    this.pedidoService.registrarPagamentoManual(codigoPedido).subscribe({
      next: () => this.finalizandoPedido.set(false),
      error: (erro) => {
        console.error('Falha ao reservar estoque do pedido manual:', erro);
        this.finalizandoPedido.set(false);
      },
    });
    this.pedidoFinalizado.set(true);
  }

  /** Botão "Tentar novamente" da tela de erro — se o pedido já foi criado (só o pagamento
   * falhou), volta pra revisão sem recriar nada (chamar finalizarPedido() de novo criaria um
   * pedido vazio, já que o carrinho foi limpo). Só cai em finalizarPedido() quando o pedido em
   * si não chegou a ser criado.
   *
   * Pix não precisa de nova interação do cliente — gera um QR code novo sozinho. Cartão é
   * diferente: token é de uso único, e a tela de erro (que substitui a página inteira, ver
   * checkout.component.html) desmonta os iframes do Secure Fields junto — então aqui só
   * remonta o formulário em branco, sem tentar cobrar de novo automaticamente. É o clique do
   * cliente em "Confirmar e finalizar pedido"/"Pagar agora" (ver confirmarPagamento) que
   * dispara a cobrança de fato, depois que ele preencher os campos de novo. */
  tentarNovamente(): void {
    if (!this.numeroPedido()) {
      this.finalizarPedido();
      return;
    }

    this.erroFinalizacao.set(null);
    if (this.formaPagamento() === 'cartao') {
      this.montarCardForm(this.valorTotalFinalizado());
      return;
    }

    this.finalizandoPedido.set(true);
    this.gerarPagamentoPix(this.numeroPedido(), this.valorTotalFinalizado());
  }

  /** Botão principal da etapa "revisao" — cria o pedido na primeira vez (finalizarPedido) ou,
   * se ele já existe (retomada, ou um "Tentar novamente" que só remontou o formulário em
   * branco), cobra o pedido existente direto: o Secure Fields já está montado e pronto (só o
   * clique confirma que o cliente terminou de preencher). */
  confirmarPagamento(): void {
    if (!this.numeroPedido()) {
      this.finalizarPedido();
      return;
    }

    this.finalizandoPedido.set(true);
    if (this.formaPagamento() === 'cartao') {
      this.pagarComCartao(this.numeroPedido(), this.valorTotalFinalizado());
    } else {
      this.gerarPagamentoPix(this.numeroPedido(), this.valorTotalFinalizado());
    }
  }

  /** Pega o token (número/CVV nunca chegam no nosso backend nem no nosso JS — ficam dentro
   * dos iframes do Secure Fields, ver mercado-pago-sdk.service.ts) e cobra o pedido já
   * criado. Diferente do Pix, a resposta já vem com o status final na hora — 'approved' fecha
   * o pedido, qualquer outro status vira erro com convite pra tentar de novo. */
  private async pagarComCartao(codigoPedido: string, valorTotal: number): Promise<void> {
    const formulario = document.getElementById('form-checkout') as HTMLFormElement | null;
    if (!this.cardForm || !formulario) {
      this.finalizandoPedido.set(false);
      this.erroFinalizacao.set('Formulário de cartão não carregou. Recarregue a página e tente de novo.');
      return;
    }

    try {
      // O botão "Pagar agora"/"Confirmar e finalizar pedido" fica fora do <form
      // id="form-checkout"> (ele confirma o pedido inteiro, não só o cartão) — então precisa
      // disparar o submit manualmente pra SDK tokenizar de verdade. A SDK intercepta esse
      // submit, faz o trabalho assíncrono (chama a API deles) e só então invoca `onSubmit`
      // (ver montarCardForm) — getCardFormData() só tem o token depois disso, nunca antes.
      // Quando os campos estão vazios/inválidos, porém, a SDK NUNCA chama onSubmit (só
      // onError, sem avisar que o envio foi cancelado) — sem o timeout abaixo, ficaria preso
      // pra sempre no "Enviando…".
      const tokenizacaoConcluiu = await new Promise<boolean>((resolve) => {
        const temporizador = setTimeout(() => {
          this.resolverEnvioCardForm = null;
          resolve(false);
        }, 6000);
        this.resolverEnvioCardForm = () => {
          clearTimeout(temporizador);
          resolve(true);
        };
        if (formulario.requestSubmit) {
          formulario.requestSubmit();
        } else {
          formulario.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });

      if (!tokenizacaoConcluiu) {
        throw new Error('Confira o número, a validade e o CVV do cartão antes de tentar de novo.');
      }

      const dadosCartao = this.cardForm.getCardFormData();
      if (!dadosCartao.token) {
        throw new Error('Não foi possível gerar o token do cartão — confira o número, validade e CVV.');
      }

      // Best-effort: se o script antifraude (carregado ao escolher "cartão", ver
      // selecionarFormaPagamento) ainda não coletou o fingerprint a tempo, segue sem ele —
      // nunca deixa de cobrar por causa disso.
      const deviceId = await this.mercadoPagoSdk.obterDeviceId();

      const pagamento = await firstValueFrom(
        this.pedidoService.criarPagamentoCartao({
          codigoPedido,
          valorTotal,
          emailCliente: this.email(),
          nomeCliente: this.nome(),
          deviceId,
          documentoCliente: this.documento(),
          token: dadosCartao.token,
          paymentMethodId: dadosCartao.paymentMethodId,
          issuerId: dadosCartao.issuerId || undefined,
          parcelas: this.parcelasFinalizadas(),
        })
      );

      this.finalizandoPedido.set(false);

      if (pagamento.status === 'approved') {
        this.pedidoFinalizado.set(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
      // Token de uso único: mesmo em erro de rede/negócio (não relacionado ao cartão em si),
      // o token já emitido não serve mais — repetirPagamentoCartao() (via "Tentar novamente")
      // remonta o Secure Fields do zero antes da próxima tentativa.
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
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
    try {
      this.cardForm?.unmount();
    } catch {
      // Idem ao comentário em montarCardForm — inofensivo se o form nunca chegou a montar.
    }
  }

  voltarParaHome(): void {
    this.router.navigate(['/']);
  }
}
