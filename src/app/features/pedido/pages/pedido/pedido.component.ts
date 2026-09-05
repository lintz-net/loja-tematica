import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Pedido, StatusPedido } from '../../../../core/modelos/pedido.model';
import { PedidoService } from '../../../../core/servicos/pedido.service';

const ETAPAS_STATUS: StatusPedido[] = ['recebido', 'confirmado', 'enviado', 'entregue'];

const ROTULOS_STATUS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
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

  readonly etapasStatus = ETAPAS_STATUS;
  readonly rotulosStatus = ROTULOS_STATUS;

  readonly carregando = signal(true);
  readonly pedido = signal<Pedido | null>(null);
  readonly naoEncontrado = signal(false);

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
  }

  indiceEtapaAtual(status: StatusPedido): number {
    return this.etapasStatus.indexOf(status);
  }
}
