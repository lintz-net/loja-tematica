import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';

@Component({
  selector: 'app-cabecalho',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cabecalho.component.html',
  styleUrl: './cabecalho.component.scss',
})
export class CabecalhoComponent {
  private readonly carrinhoService = inject(CarrinhoService);

  readonly quantidadeTotalItens = this.carrinhoService.quantidadeTotalItens;
}
