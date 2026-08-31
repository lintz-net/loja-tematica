import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CabecalhoComponent } from './shared/componentes/cabecalho/cabecalho.component';
import { RodapeComponent } from './shared/componentes/rodape/rodape.component';
import { CarrinhoGavetaComponent } from './shared/componentes/carrinho-gaveta/carrinho-gaveta.component';
import { BuscaGlobalComponent } from './shared/componentes/busca-global/busca-global.component';
import { BarraProgressoComponent } from './shared/componentes/barra-progresso/barra-progresso.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CabecalhoComponent,
    RodapeComponent,
    CarrinhoGavetaComponent,
    BuscaGlobalComponent,
    BarraProgressoComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor() {
    this.exibirEasterEggConsole();
  }

  private exibirEasterEggConsole(): void {
    console.log(
      '%c ✦ NOSTÁLGIKA ✦ %c\nCuriosidade que te trouxe até aqui? Bora fazer parte do time: contato@nostalgika.com.br',
      'background: linear-gradient(135deg, #ffb545, #0c7d71); color: #17141a; font-weight: 800; padding: 8px 14px; border-radius: 4px; font-size: 14px;',
      'color: #5c5566; font-size: 12px;'
    );
  }
}
