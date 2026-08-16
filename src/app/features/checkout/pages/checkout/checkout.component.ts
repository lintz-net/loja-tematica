import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CarrinhoService } from '../../../../core/servicos/carrinho.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent {
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly router = inject(Router);

  readonly itens = this.carrinhoService.itensCarrinho;
  readonly valorTotal = this.carrinhoService.valorTotal;

  readonly formaPagamento = signal<'cartao' | 'pix' | 'boleto'>('pix');
  readonly pedidoFinalizado = signal(false);

  selecionarFormaPagamento(forma: 'cartao' | 'pix' | 'boleto'): void {
    this.formaPagamento.set(forma);
  }

  finalizarPedidoSimulado(): void {
    this.pedidoFinalizado.set(true);
    this.carrinhoService.limparCarrinho();
  }

  voltarParaHome(): void {
    this.router.navigate(['/']);
  }
}
