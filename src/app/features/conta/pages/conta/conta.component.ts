import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/servicos/auth.service';
import { PedidoService } from '../../../../core/servicos/pedido.service';
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

  readonly autenticado = this.authService.autenticado;
  readonly email = computed(() => this.authService.sessao()?.user?.email ?? '');

  readonly emailDigitado = signal('');
  readonly linkEnviado = signal(false);
  readonly enviandoLink = signal(false);
  readonly erro = signal<string | null>(null);

  readonly carregandoPedidos = signal(false);
  readonly pedidos = signal<Pedido[]>([]);
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
}
