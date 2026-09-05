import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Pedido, StatusPedido } from '../../../../core/modelos/pedido.model';
import { AuthService } from '../../../../core/servicos/auth.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';

const STATUS_DISPONIVEIS: StatusPedido[] = ['recebido', 'confirmado', 'enviado', 'entregue'];

const ROTULOS_STATUS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.scss',
})
export class AdminPedidosComponent {
  private readonly pedidoService = inject(PedidoService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly statusDisponiveis = STATUS_DISPONIVEIS;
  readonly rotulosStatus = ROTULOS_STATUS;

  readonly carregando = signal(true);
  readonly pedidos = signal<Pedido[]>([]);
  readonly erro = signal<string | null>(null);
  readonly codigoSalvando = signal<string | null>(null);

  constructor() {
    this.carregarPedidos();
  }

  private carregarPedidos(): void {
    this.carregando.set(true);
    this.pedidoService.listarTodos().subscribe({
      next: (pedidos) => {
        this.pedidos.set(pedidos);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os pedidos.');
        this.carregando.set(false);
      },
    });
  }

  atualizarStatus(codigo: string, status: string): void {
    this.codigoSalvando.set(codigo);
    this.pedidoService.atualizarStatus(codigo, status as StatusPedido).subscribe({
      next: (pedidoAtualizado) => {
        this.pedidos.update((atual) =>
          atual.map((p) => (p.codigo === codigo ? pedidoAtualizado : p))
        );
        this.codigoSalvando.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível atualizar o pedido ${codigo}.`);
        this.codigoSalvando.set(null);
      },
    });
  }

  sair(): void {
    this.authService.sair().subscribe(() => this.router.navigate(['/admin/login']));
  }
}
