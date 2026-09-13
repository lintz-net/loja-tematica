import { Component, computed, inject } from '@angular/core';
import { ConfiguracaoLojaService } from '../../../core/servicos/configuracao-loja.service';

@Component({
  selector: 'app-whatsapp-flutuante',
  standalone: true,
  templateUrl: './whatsapp-flutuante.component.html',
  styleUrl: './whatsapp-flutuante.component.scss',
})
export class WhatsappFlutuanteComponent {
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);

  readonly linkWhatsapp = computed(() => {
    const configuracao = this.configuracaoLojaService.configuracao();
    if (!configuracao) return '';
    return `https://wa.me/${configuracao.whatsappNumero}?text=${encodeURIComponent(configuracao.whatsappMensagem)}`;
  });
}
