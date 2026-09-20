import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Produto } from '../../../core/modelos/produto.model';
import { CartaoProdutoComponent } from '../cartao-produto/cartao-produto.component';

/** Carrossel de produtos por scroll horizontal (scroll-snap) — ao contrário de
 * `app-carrossel` (banners, 1 slide por vez com autoplay), aqui vários cards ficam visíveis
 * lado a lado e o usuário navega por scroll/setas; sem autoplay, já que produtos não
 * precisam trocar sozinhos como um banner promocional. */
@Component({
  selector: 'app-carrossel-produtos',
  standalone: true,
  imports: [CartaoProdutoComponent],
  templateUrl: './carrossel-produtos.component.html',
  styleUrl: './carrossel-produtos.component.scss',
})
export class CarrosselProdutosComponent {
  @Input({ required: true }) produtos: Produto[] = [];

  @ViewChild('trilho') trilho!: ElementRef<HTMLElement>;

  private rolar(distancia: number): void {
    this.trilho.nativeElement.scrollBy({ left: distancia, behavior: 'smooth' });
  }

  anterior(): void {
    this.rolar(-this.trilho.nativeElement.clientWidth * 0.9);
  }

  proximo(): void {
    this.rolar(this.trilho.nativeElement.clientWidth * 0.9);
  }
}
