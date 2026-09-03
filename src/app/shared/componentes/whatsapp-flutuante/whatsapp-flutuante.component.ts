import { Component } from '@angular/core';

const NUMERO_WHATSAPP = '5519991354644';
const MENSAGEM_PADRAO = 'Olá! Preciso de ajuda com um produto da Nostálgika.';

@Component({
  selector: 'app-whatsapp-flutuante',
  standalone: true,
  templateUrl: './whatsapp-flutuante.component.html',
  styleUrl: './whatsapp-flutuante.component.scss',
})
export class WhatsappFlutuanteComponent {
  readonly linkWhatsapp = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(MENSAGEM_PADRAO)}`;
}
