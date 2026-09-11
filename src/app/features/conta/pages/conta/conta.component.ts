import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/servicos/auth.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';
import { Pedido } from '../../../../core/modelos/pedido.model';

@Component({
  selector: 'app-conta',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './conta.component.html',
  styleUrl: './conta.component.scss',
})
export class ContaComponent {
  private readonly authService = inject(AuthService);
  private readonly pedidoService = inject(PedidoService);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly router = inject(Router);

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

  constructor() {
    /** `autenticado` só vira `true` depois que o Supabase resolve a sessão de forma
     * assíncrona (ver AuthService) — reage a essa mudança pra carregar os pedidos assim que
     * ela chegar, tanto no primeiro load quanto logo após o login pelo link mágico. */
    effect(() => {
      if (!this.autenticado()) {
        this.pedidos.set([]);
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
}
