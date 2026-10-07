import { isPlatformBrowser } from '@angular/common';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Pedido, StatusPedido } from '../../../../core/modelos/pedido.model';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { Envio, EnvioService, StatusEnvio } from '../../../../core/servicos/envio.service';
import { obterLogoTransportadora } from '../../../../shared/dados/logos-transportadora';

const ETAPAS_STATUS: StatusPedido[] = ['recebido', 'confirmado', 'enviado', 'entregue'];

const ROTULOS_STATUS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

/** Etapas do envio mostradas na timeline pro cliente — só os status "normais" do ciclo de
 * vida (created→generated→posted→delivered); pausado/suspenso/cancelado/não-entregue e o
 * estado antes da compra aparecem como um aviso à parte, não como um degrau da timeline. */
const ETAPAS_ENVIO: StatusEnvio[] = ['criado', 'liberado', 'gerado', 'postado', 'entregue'];

const ROTULOS_STATUS_ENVIO: Record<StatusEnvio, string> = {
  aguardando_compra: 'Aguardando compra da etiqueta',
  pendente_etiqueta: 'Compra da etiqueta pendente',
  processando: 'Gerando etiqueta…',
  criado: 'Envio criado',
  pendente: 'Pendente',
  liberado: 'Liberado pra postagem',
  gerado: 'Etiqueta gerada',
  postado: 'Postado',
  entregue: 'Entregue',
  nao_entregue: 'Não entregue',
  pausado: 'Pausado',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

@Component({
  selector: 'app-pedido',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './pedido.component.html',
  styleUrl: './pedido.component.scss',
})
export class PedidoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly pedidoService = inject(PedidoService);
  private readonly envioService = inject(EnvioService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  readonly etapasStatus = ETAPAS_STATUS;
  readonly rotulosStatus = ROTULOS_STATUS;
  readonly etapasEnvio = ETAPAS_ENVIO;
  readonly rotulosStatusEnvio = ROTULOS_STATUS_ENVIO;
  readonly obterLogoTransportadora = obterLogoTransportadora;

  /** Central de rastreio deles (login não exigido) — cobre Correios, Jadlog e as outras
   * transportadoras da plataforma num único lugar, sem precisar montar um link por
   * transportadora (formato de deep-link com o código embutido não é documentado/estável o
   * bastante pra confiar, e varia por transportadora). */
  readonly urlMelhorRastreio = 'https://melhorrastreio.com.br/';

  readonly carregando = signal(true);
  readonly pedido = signal<Pedido | null>(null);
  readonly naoEncontrado = signal(false);
  readonly envio = signal<Envio | null>(null);
  readonly codigoRastreioCopiado = signal(false);

  /** "Pagar agora"/"Tentar pagar de novo" só faz sentido pra pedido pendente ou recusado — o
   * fluxo de retomada em si (gerar Pix de novo, ou pedir os dados do cartão de novo, sem
   * recriar o pedido) mora em /checkout/:codigoRetomada (checkout.component.ts,
   * modoRetomada), reaproveitando a mesma tela de revisão do "Como comprar" em vez de
   * duplicar essa UI aqui. Exclui 'manual' ("Combinar pagamento") — esses pedidos não têm
   * cobrança nenhuma no Mercado Pago pra retomar, /checkout/:codigoRetomada nem suporta esse
   * caso (ver aguardandoConfirmacaoManual, que mostra o aviso certo pra esses). */
  readonly podeRetomarPagamento = computed(() => {
    const pedido = this.pedido();
    return (
      !!pedido &&
      pedido.formaPagamento !== 'manual' &&
      (pedido.statusPagamento === 'pendente' || pedido.statusPagamento === 'recusado')
    );
  });

  /** "Combinar pagamento" — pedido pendente de confirmação manual do admin (ver
   * ConfiguracaoLoja.aceitaPagamentoManual), sem nada que o cliente precise/possa fazer aqui
   * além de esperar — diferente de podeRetomarPagamento, não mostra botão nenhum. */
  readonly aguardandoConfirmacaoManual = computed(() => {
    const pedido = this.pedido();
    return !!pedido && pedido.formaPagamento === 'manual' && pedido.statusPagamento !== 'aprovado';
  });

  /** Cancela a inscrição Realtime da consulta anterior, se houver — evita acumular listeners
   * quando o Angular Router reaproveita esta mesma instância navegando entre duas URLs
   * `/pedido/:codigo` diferentes (ver observação sobre paramMap abaixo). */
  private cancelarEscutaRealtime: (() => void) | null = null;

  constructor() {
    // Observable, não snapshot: se o Router reaproveitar esta MESMA instância navegando de
    // /pedido/A pra /pedido/B sem reload de página inteira (mesma config de rota, só o
    // parâmetro muda), um snapshot lido só na construção ficaria travado no primeiro pedido
    // carregado. takeUntilDestroyed evita vazar a subscription quando o componente for
    // destruído de verdade (mesmo padrão de checkout.component.ts).
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const codigo = params.get('codigo') ?? '';
      this.carregarPedido(codigo);
    });
  }

  private carregarPedido(codigo: string): void {
    this.cancelarEscutaRealtime?.();
    this.cancelarEscutaRealtime = null;

    this.carregando.set(true);
    this.naoEncontrado.set(false);
    this.pedido.set(null);
    this.envio.set(null);

    this.pedidoService.obterPorCodigo(codigo).subscribe({
      next: (pedido) => {
        this.pedido.set(pedido);
        this.naoEncontrado.set(pedido === null);
        this.carregando.set(false);
      },
      error: () => {
        this.naoEncontrado.set(true);
        this.carregando.set(false);
      },
    });

    this.envioService.obterPorCodigoPedido(codigo).subscribe((envio) => this.envio.set(envio));

    /** Realtime só no browser — o cliente completo trava em Node < 22 durante o SSR (ver
     * comentário em EnvioService.escutarMudancas). */
    if (this.isBrowser) {
      const cancelar = this.envioService.escutarMudancas(codigo, (envio) => this.envio.set(envio));
      this.cancelarEscutaRealtime = cancelar;
      this.destroyRef.onDestroy(cancelar);
    }
  }

  indiceEtapaAtual(status: StatusPedido): number {
    return this.etapasStatus.indexOf(status);
  }

  indiceEtapaEnvio(status: StatusEnvio): number {
    return this.etapasEnvio.indexOf(status);
  }

  copiarCodigoRastreio(codigo: string): void {
    navigator.clipboard.writeText(codigo).then(() => {
      this.codigoRastreioCopiado.set(true);
      setTimeout(() => this.codigoRastreioCopiado.set(false), 2000);
    });
  }
}
