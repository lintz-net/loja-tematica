import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/servicos/auth.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { SolicitacaoTrocaService } from '../../../../core/servicos/solicitacao-troca.service';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { ItemPedido, Pedido } from '../../../../core/modelos/pedido.model';
import { SolicitacaoTroca, TipoSolicitacaoTroca } from '../../../../core/modelos/solicitacao-troca.model';
import { ModalComponent } from '../../../../shared/componentes/modal/modal.component';
import { gerarComprovantePedidoPdf } from '../../../../core/utilitarios/comprovante-pedido.util';

/** Mesmo prazo de 15 dias corridos anunciado na página institucional "Trocas e devoluções"
 * (`app.routes.ts`, PAGINA_TROCAS_DEVOLUCOES) — mantém as duas fontes de verdade em sincronia
 * manualmente (não dá pra derivar uma da outra, são módulos sem ligação). */
const PRAZO_TROCA_DEVOLUCAO_DIAS = 15;

const ROTULOS_STATUS_SOLICITACAO: Record<SolicitacaoTroca['status'], string> = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  concluida: 'Concluída',
};

@Component({
  selector: 'app-conta',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe, ModalComponent],
  templateUrl: './conta.component.html',
  styleUrl: './conta.component.scss',
})
export class ContaComponent {
  private readonly authService = inject(AuthService);
  private readonly pedidoService = inject(PedidoService);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly solicitacaoTrocaService = inject(SolicitacaoTrocaService);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);
  private readonly router = inject(Router);

  readonly rotulosStatusSolicitacao = ROTULOS_STATUS_SOLICITACAO;

  readonly autenticado = this.authService.autenticado;
  readonly email = computed(() => this.authService.sessao()?.user?.email ?? '');

  readonly emailDigitado = signal('');
  readonly linkEnviado = signal(false);
  readonly enviandoLink = signal(false);
  readonly erro = signal<string | null>(null);

  readonly carregandoPedidos = signal(false);
  readonly pedidos = signal<Pedido[]>([]);

  readonly codigoRecomprando = signal<string | null>(null);
  readonly avisoRecompra = signal<string | null>(null);

  readonly codigoGerandoComprovante = signal<string | null>(null);

  readonly solicitacoes = signal<SolicitacaoTroca[]>([]);

  // Modal "Solicitar troca/devolução"
  readonly pedidoSolicitando = signal<Pedido | null>(null);
  readonly tipoSolicitacao = signal<TipoSolicitacaoTroca>('troca');
  readonly itensMarcados = signal<Set<number>>(new Set());
  readonly motivoSolicitacao = signal('');
  readonly observacoesSolicitacao = signal('');
  readonly enviandoSolicitacao = signal(false);
  readonly erroSolicitacao = signal<string | null>(null);
  readonly solicitacaoEnviada = signal(false);

  constructor() {
    /** `autenticado` só vira `true` depois que o Supabase resolve a sessão de forma
     * assíncrona (ver AuthService) — reage a essa mudança pra carregar os pedidos assim que
     * ela chegar, tanto no primeiro load quanto logo após o login pelo link mágico. */
    effect(() => {
      if (!this.autenticado()) {
        this.pedidos.set([]);
        this.solicitacoes.set([]);
        return;
      }
      this.carregandoPedidos.set(true);
      this.pedidoService.listarMeusPedidos().subscribe({
        next: (pedidos) => {
          this.pedidos.set(pedidos);
          this.carregandoPedidos.set(false);
        },
        error: () => this.carregandoPedidos.set(false),
      });
      this.solicitacaoTrocaService.listarMinhas().subscribe((solicitacoes) => {
        this.solicitacoes.set(solicitacoes);
      });
    });
  }

  /** Mesma regra de 15 dias corridos da página institucional — depois disso o botão de
   * solicitar troca/devolução some (fica só o canal por e-mail, mencionado ali). */
  dentroDoPrazoTroca(pedido: Pedido): boolean {
    const diasCorridos = (Date.now() - new Date(pedido.criadoEm).getTime()) / (1000 * 60 * 60 * 24);
    return diasCorridos <= PRAZO_TROCA_DEVOLUCAO_DIAS;
  }

  abrirSolicitacao(pedido: Pedido): void {
    this.pedidoSolicitando.set(pedido);
    this.tipoSolicitacao.set('troca');
    this.itensMarcados.set(new Set());
    this.motivoSolicitacao.set('');
    this.observacoesSolicitacao.set('');
    this.erroSolicitacao.set(null);
    this.solicitacaoEnviada.set(false);
  }

  fecharSolicitacao(): void {
    this.pedidoSolicitando.set(null);
  }

  alternarItemMarcado(indice: number): void {
    this.itensMarcados.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(indice)) {
        novo.delete(indice);
      } else {
        novo.add(indice);
      }
      return novo;
    });
  }

  podeEnviarSolicitacao(): boolean {
    return this.itensMarcados().size > 0 && this.motivoSolicitacao().trim().length > 0;
  }

  enviarSolicitacao(): void {
    const pedido = this.pedidoSolicitando();
    if (!pedido || !this.podeEnviarSolicitacao()) return;

    const itens: ItemPedido[] = pedido.itens.filter((_, indice) => this.itensMarcados().has(indice));

    this.enviandoSolicitacao.set(true);
    this.erroSolicitacao.set(null);
    this.solicitacaoTrocaService
      .criar({
        pedidoCodigo: pedido.codigo,
        emailCliente: pedido.emailCliente,
        nomeCliente: pedido.nomeCliente,
        tipo: this.tipoSolicitacao(),
        itens: itens.map((item) => ({
          produtoNome: item.produtoNome,
          produtoSlug: item.produtoSlug,
          tamanho: item.tamanho,
          cor: item.cor,
          quantidade: item.quantidade,
        })),
        motivo: this.motivoSolicitacao().trim(),
        observacoes: this.observacoesSolicitacao().trim() || undefined,
      })
      .subscribe({
        next: (solicitacao) => {
          this.solicitacoes.update((atual) => [solicitacao, ...atual]);
          this.enviandoSolicitacao.set(false);
          this.solicitacaoEnviada.set(true);
        },
        error: () => {
          this.enviandoSolicitacao.set(false);
          this.erroSolicitacao.set('Não foi possível enviar sua solicitação. Tente de novo em instantes.');
        },
      });
  }

  atualizarEmailDigitado(valor: string): void {
    this.emailDigitado.set(valor);
    this.erro.set(null);
  }

  enviarLinkMagico(): void {
    const email = this.emailDigitado().trim();
    if (!email) return;

    this.enviandoLink.set(true);
    this.erro.set(null);
    this.authService.entrarComLinkMagico(email).subscribe({
      next: () => {
        this.enviandoLink.set(false);
        this.linkEnviado.set(true);
      },
      error: () => {
        this.enviandoLink.set(false);
        this.erro.set('Não foi possível enviar o link. Confira o e-mail e tente de novo.');
      },
    });
  }

  sair(): void {
    this.authService.sair().subscribe();
  }

  /** Adiciona os itens de um pedido antigo ao carrinho de novo — busca o produto/variante
   * *atuais* do catálogo (nunca reaproveita preço/estoque salvos no pedido, que podem estar
   * desatualizados) e pula silenciosamente qualquer item que não exista mais ou esteja sem
   * estoque, avisando ao final quantos ficaram de fora. */
  async comprarNovamente(pedido: Pedido): Promise<void> {
    this.codigoRecomprando.set(pedido.codigo);
    this.avisoRecompra.set(null);

    let adicionados = 0;
    let indisponiveis = 0;

    for (const item of pedido.itens) {
      const produto = await firstValueFrom(
        this.catalogoRepositorio.obterProdutoPorSlug(item.produtoSlug)
      );
      const variante = produto?.variantes.find(
        (v) => v.tamanho === item.tamanho && v.cor === item.cor
      );

      if (produto && variante && variante.quantidadeEstoque > 0) {
        this.carrinhoService.adicionarItem(produto, variante, item.quantidade);
        adicionados++;
      } else {
        indisponiveis++;
      }
    }

    this.codigoRecomprando.set(null);

    if (adicionados === 0) {
      this.avisoRecompra.set('Nenhum item desse pedido está disponível no momento.');
      return;
    }
    if (indisponiveis > 0) {
      this.avisoRecompra.set(
        `${indisponiveis} item(ns) do pedido não está(ão) mais disponível(is) e não foi(ram) adicionado(s) ao carrinho.`
      );
    }
    this.router.navigate(['/carrinho']);
  }

  /** PDF gerado inteiramente no navegador (ver comprovante-pedido.util.ts) — não é nota
   * fiscal, só um resumo do pedido pro cliente guardar/imprimir. */
  async baixarComprovante(pedido: Pedido): Promise<void> {
    this.codigoGerandoComprovante.set(pedido.codigo);
    try {
      const nomeLoja = this.configuracaoLojaService.configuracao()?.nomeLoja ?? 'Vista Nostálgica';
      await gerarComprovantePedidoPdf(pedido, nomeLoja);
    } finally {
      this.codigoGerandoComprovante.set(null);
    }
  }
}
