import { isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { ConfiguracaoLojaService } from '../../../core/servicos/configuracao-loja.service';

const INTERVALO_MS = 5000;

/** Mensagens rotativas acima do cabeçalho (frete grátis, parcelamento sem juros, prazo de
 * entrega etc.), configuradas em /admin/config — some por completo sem nenhuma mensagem
 * cadastrada. Transição estática (crossfade), sem efeito de letreiro corrido. */
@Component({
  selector: 'app-barra-anuncio',
  standalone: true,
  templateUrl: './barra-anuncio.component.html',
  styleUrl: './barra-anuncio.component.scss',
})
export class BarraAnuncioComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);

  readonly mensagens = () => this.configuracaoLojaService.configuracao()?.mensagensBarraAnuncio ?? [];
  readonly indiceAtual = signal(0);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.temporizador = setInterval(() => {
      const total = this.mensagens().length;
      if (total === 0) return;
      this.indiceAtual.update((i) => (i + 1) % total);
    }, INTERVALO_MS);
  }

  ngOnDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
  }
}
