import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Pedido, StatusPedido } from '../../../../core/modelos/pedido.model';
import { AuthService } from '../../../../core/servicos/auth.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { Envio, EnvioService, StatusEnvio } from '../../../../core/servicos/envio.service';

const STATUS_DISPONIVEIS: StatusPedido[] = ['recebido', 'confirmado', 'enviado', 'entregue'];

const ROTULOS_STATUS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

const ROTULOS_STATUS_ENVIO: Record<StatusEnvio, string> = {
  aguardando_compra: 'Aguardando compra',
  pendente_etiqueta: 'Falhou — pendente',
  criado: 'Criado',
  pendente: 'Pendente',
  liberado: 'Liberado',
  gerado: 'Etiqueta gerada',
  postado: 'Postado',
  entregue: 'Entregue',
  nao_entregue: 'Não entregue',
  pausado: 'Pausado',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.scss',
})
export class AdminPedidosComponent {
  private readonly pedidoService = inject(PedidoService);
  private readonly envioService = inject(EnvioService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly statusDisponiveis = STATUS_DISPONIVEIS;
  readonly rotulosStatus = ROTULOS_STATUS;
  readonly rotulosStatusEnvio = ROTULOS_STATUS_ENVIO;

  readonly carregando = signal(true);
  readonly pedidos = signal<Pedido[]>([]);
  readonly envios = signal<Map<string, Envio>>(new Map());
  readonly erro = signal<string | null>(null);
  readonly codigoSalvando = signal<string | null>(null);
  readonly codigoComprandoEtiqueta = signal<string | null>(null);

  constructor() {
    this.carregarPedidos();
  }

  private carregarPedidos(): void {
    this.carregando.set(true);
    this.pedidoService.listarTodos().subscribe({
      next: (pedidos) => {
        this.pedidos.set(pedidos);
        this.carregando.set(false);
        this.carregarEnvios();
      },
      error: () => {
        this.erro.set('Não foi possível carregar os pedidos.');
        this.carregando.set(false);
      },
    });
  }

  private carregarEnvios(): void {
    this.envioService.listarTodos().subscribe({
      next: (envios) => this.envios.set(envios),
      error: () => {
        // não bloqueia a listagem de pedidos — o status de envio fica indisponível
      },
    });
  }

  envioDoPedido(codigo: string): Envio | null {
    return this.envios().get(codigo) ?? null;
  }

  /** Etiqueta só pode ser comprada quando o pedido tem frete escolhido e ainda não tem envio
   * gerado/comprado com sucesso — falhas anteriores (pendente_etiqueta) podem ser tentadas de novo. */
  podeComprarEtiqueta(pedido: Pedido): boolean {
    if (!pedido.freteServicoId) return false;
    const envio = this.envioDoPedido(pedido.codigo);
    return !envio || envio.statusEnvio === 'aguardando_compra' || envio.statusEnvio === 'pendente_etiqueta';
  }

  /** Pede o CPF/CNPJ do destinatário via prompt só quando o pedido não tem esse dado (pedidos
   * antigos, de antes do checkout coletar isso) — o Melhor Envio exige pra gerar a etiqueta. */
  async comprarEtiqueta(pedido: Pedido): Promise<void> {
    let documento = pedido.documentoCliente;
    if (!documento) {
      const digitado = window.prompt('CPF ou CNPJ do destinatário (exigido pelo Melhor Envio):');
      if (digitado === null) return;
      documento = digitado;
    }

    this.codigoComprandoEtiqueta.set(pedido.codigo);
    this.erro.set(null);
    const resultado = await this.envioService.comprarEtiqueta(pedido.codigo, documento);
    this.codigoComprandoEtiqueta.set(null);
    if (!resultado.ok) {
      this.erro.set(`Falha ao comprar etiqueta do pedido ${pedido.codigo}: ${resultado.error}`);
    }
    this.carregarEnvios();
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
