import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Pedido, StatusPedido } from '../../../../core/modelos/pedido.model';
import { PedidoService } from '../../../../core/servicos/pedido.service';

const ROTULOS_STATUS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

const STATUS_ORDEM: StatusPedido[] = ['recebido', 'confirmado', 'enviado', 'entregue'];

interface ProdutoVendido {
  produtoSlug: string;
  produtoNome: string;
  quantidade: number;
  receita: number;
}

const DIA_EM_MS = 24 * 60 * 60 * 1000;

/** Painel com números consolidados de venda — calculado no browser a partir da mesma lista
 * de pedidos que `/admin/pedidos` já usa (RLS já restringe isso a admin), sem precisar de
 * nenhuma tabela/endpoint novo. Pra um volume de pedidos de loja pequena, isso é suficiente;
 * se o catálogo de pedidos crescer muito, vale mover esse cálculo pro banco (view/RPC). */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly pedidoService = inject(PedidoService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly pedidos = signal<Pedido[]>([]);

  readonly rotulosStatus = ROTULOS_STATUS;
  readonly statusOrdem = STATUS_ORDEM;

  readonly totalPedidos = computed(() => this.pedidos().length);
  readonly totalVendido = computed(() =>
    this.pedidos().reduce((soma, p) => soma + p.valorTotal, 0)
  );
  readonly ticketMedio = computed(() =>
    this.totalPedidos() > 0 ? this.totalVendido() / this.totalPedidos() : 0
  );

  private readonly pedidosUltimos30Dias = computed(() => {
    const limite = Date.now() - 30 * DIA_EM_MS;
    return this.pedidos().filter((p) => new Date(p.criadoEm).getTime() >= limite);
  });
  readonly totalPedidos30Dias = computed(() => this.pedidosUltimos30Dias().length);
  readonly totalVendido30Dias = computed(() =>
    this.pedidosUltimos30Dias().reduce((soma, p) => soma + p.valorTotal, 0)
  );

  readonly pedidosPorStatus = computed(() => {
    const contagem: Record<StatusPedido, number> = {
      recebido: 0,
      confirmado: 0,
      enviado: 0,
      entregue: 0,
    };
    for (const pedido of this.pedidos()) {
      contagem[pedido.status]++;
    }
    return contagem;
  });

  /** Maior contagem entre os status — usado só pra calcular a largura relativa das barras. */
  readonly maiorContagemStatus = computed(() =>
    Math.max(1, ...Object.values(this.pedidosPorStatus()))
  );

  readonly produtosMaisVendidos = computed<ProdutoVendido[]>(() => {
    const porProduto = new Map<string, ProdutoVendido>();
    for (const pedido of this.pedidos()) {
      for (const item of pedido.itens) {
        const existente = porProduto.get(item.produtoSlug);
        const receitaItem = item.precoUnitario * item.quantidade;
        if (existente) {
          existente.quantidade += item.quantidade;
          existente.receita += receitaItem;
        } else {
          porProduto.set(item.produtoSlug, {
            produtoSlug: item.produtoSlug,
            produtoNome: item.produtoNome,
            quantidade: item.quantidade,
            receita: receitaItem,
          });
        }
      }
    }
    return Array.from(porProduto.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  });

  constructor() {
    this.pedidoService.listarTodos().subscribe({
      next: (pedidos) => {
        this.pedidos.set(pedidos);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os dados do dashboard.');
        this.carregando.set(false);
      },
    });
  }
}
