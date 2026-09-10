import { isPlatformBrowser } from '@angular/common';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
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

  readonly carregando = signal(true);
  readonly pedido = signal<Pedido | null>(null);
  readonly naoEncontrado = signal(false);
  readonly envio = signal<Envio | null>(null);

  constructor() {
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
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
      this.destroyRef.onDestroy(cancelar);
    }
  }

  indiceEtapaAtual(status: StatusPedido): number {
    return this.etapasStatus.indexOf(status);
  }

  indiceEtapaEnvio(status: StatusEnvio): number {
    return this.etapasEnvio.indexOf(status);
  }
}
