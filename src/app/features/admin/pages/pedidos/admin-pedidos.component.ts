import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Pedido, StatusPedido } from '../../../../core/modelos/pedido.model';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { Envio, EnvioService, StatusEnvio } from '../../../../core/servicos/envio.service';

const STATUS_DISPONIVEIS: StatusPedido[] = ['recebido', 'confirmado', 'enviado', 'entregue'];

/** Tempo em 'processando' (geração da etiqueta aceita pro processamento assíncrono do Melhor
 * Envio, mas ainda sem confirmação real via webhook order.generated) além do qual tratamos
 * como travado — o admin só descobriria isso olhando o painel deles diretamente, senão.
 * Detecção client-side simples (checada quando a tela é aberta), sem cron/infra nova — ver
 * TODO.md pra uma alternativa mais robusta (cron que reverte sozinho pra
 * 'pendente_etiqueta'), considerada e deixada de lado por enquanto. */
const TIMEOUT_PROCESSANDO_MS = 20 * 60 * 1000;

const ROTULOS_STATUS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
};

const ROTULOS_STATUS_ENVIO: Record<StatusEnvio, string> = {
  aguardando_compra: 'Aguardando compra',
  pendente_etiqueta: 'Falhou — pendente',
  processando: 'Gerando etiqueta…',
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
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.scss',
})
export class AdminPedidosComponent {
  private readonly pedidoService = inject(PedidoService);
  private readonly envioService = inject(EnvioService);

  readonly statusDisponiveis = STATUS_DISPONIVEIS;
  readonly rotulosStatus = ROTULOS_STATUS;
  readonly rotulosStatusEnvio = ROTULOS_STATUS_ENVIO;

  readonly carregando = signal(true);
  readonly pedidos = signal<Pedido[]>([]);
  readonly envios = signal<Map<string, Envio>>(new Map());
  readonly erro = signal<string | null>(null);
  readonly codigoSalvando = signal<string | null>(null);
  readonly codigoComprandoEtiqueta = signal<string | null>(null);
  readonly codigoConfirmandoPagamento = signal<string | null>(null);

  /** "Aguardando confirmação manual" — entrega local (grátis, sem etiqueta do Melhor Envio,
   * ver `checkout.component.ts` → `ID_FRETE_LOCAL`) nunca gera evento de webhook, então a
   * automação de status (`avancarStatusPedido` nas Edge Functions) não tem como avançar esses
   * pedidos sozinha pra "Enviado"/"Entregue" — eles ficam parados em "Confirmado" até alguém
   * mudar na mão aqui. Sinal: sem freteServicoId (não é serviço real do Melhor Envio) mas com
   * freteTransportadora preenchida (distingue de pedido antigo sem frete nenhum registrado). */
  readonly aguardaConfirmacaoManual = (pedido: Pedido): boolean =>
    !pedido.freteServicoId &&
    !!pedido.freteTransportadora &&
    pedido.statusPagamento === 'aprovado' &&
    pedido.status === 'confirmado';

  readonly somenteAguardandoManual = signal(false);

  readonly quantidadeAguardandoManual = computed(
    () => this.pedidos().filter((p) => this.aguardaConfirmacaoManual(p)).length
  );

  readonly pedidosFiltrados = computed(() => {
    if (!this.somenteAguardandoManual()) return this.pedidos();
    return this.pedidos().filter((p) => this.aguardaConfirmacaoManual(p));
  });

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

  /** Envio preso em 'processando' (geração aceita pro processamento assíncrono do Melhor
   * Envio, mas nunca confirmada via webhook order.generated) além de TIMEOUT_PROCESSANDO_MS —
   * detecção client-side simples, checada só quando a tela é aberta/atualizada (sem
   * cron/polling em background). */
  envioTravado(envio: Envio): boolean {
    if (envio.statusEnvio !== 'processando') return false;
    return Date.now() - new Date(envio.atualizadoEm).getTime() > TIMEOUT_PROCESSANDO_MS;
  }

  /** Etiqueta só pode ser comprada quando o pedido tem frete escolhido e ainda não tem envio
   * gerado/comprado com sucesso — falhas anteriores (pendente_etiqueta) podem ser tentadas de
   * novo, um envio cancelado (pelo admin no painel do Melhor Envio, ex.: geração que travou
   * do lado deles — visto na prática em 2026-09-27) também precisa poder comprar etiqueta
   * nova, e um envio preso em 'processando' por tempo demais (ver envioTravado) igual. */
  podeComprarEtiqueta(pedido: Pedido): boolean {
    if (!pedido.freteServicoId) return false;
    const envio = this.envioDoPedido(pedido.codigo);
    return (
      !envio ||
      envio.statusEnvio === 'aguardando_compra' ||
      envio.statusEnvio === 'pendente_etiqueta' ||
      envio.statusEnvio === 'cancelado' ||
      this.envioTravado(envio)
    );
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

  /** "Combinar pagamento" (ver ConfiguracaoLoja.aceitaPagamentoManual) — admin confirma que
   * recebeu de verdade (dinheiro, Pix combinado etc.), marcando statusPagamento 'aprovado'
   * pra esse pedido se comportar igual aos pagos via Mercado Pago dali pra frente (statusPagamento
   * é usado por outras partes do admin, ex.: `aguardaConfirmacaoManual` acima). */
  confirmarPagamentoManual(pedido: Pedido): void {
    this.codigoConfirmandoPagamento.set(pedido.codigo);
    this.pedidoService.confirmarPagamentoManual(pedido.codigo).subscribe({
      next: (pedidoAtualizado) => {
        this.pedidos.update((atual) =>
          atual.map((p) => (p.codigo === pedido.codigo ? pedidoAtualizado : p))
        );
        this.codigoConfirmandoPagamento.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível confirmar o pagamento do pedido ${pedido.codigo}.`);
        this.codigoConfirmandoPagamento.set(null);
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
}
