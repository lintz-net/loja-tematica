import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CarrinhoService } from '../../../core/servicos/carrinho.service';
import { BuscaService } from '../../../core/servicos/busca.service';

@Component({
  selector: 'app-cabecalho',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cabecalho.component.html',
  styleUrl: './cabecalho.component.scss',
})
export class CabecalhoComponent {
  private readonly carrinhoService = inject(CarrinhoService);
  private readonly buscaService = inject(BuscaService);

  readonly quantidadeTotalItens = this.carrinhoService.quantidadeTotalItens;

  alternarCarrinho(): void {
    this.carrinhoService.alternarGaveta();
  }

  alternarBusca(): void {
    this.buscaService.alternar();
  }
}
