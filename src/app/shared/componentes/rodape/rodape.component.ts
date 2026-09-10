import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rodape',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './rodape.component.html',
  styleUrl: './rodape.component.scss',
})
export class RodapeComponent {
  readonly anoAtual = new Date().getFullYear();

  readonly emailNewsletter = signal('');
  readonly newsletterEnviada = signal(false);

  /** Logos de bandeiras/transportadoras — arquivos ainda não incluídos no repo (ver
   * public/imagens/pagamentos e public/imagens/envio). Enquanto o arquivo não existir, o
   * `(error)` no template esconde a tag em vez de mostrar o ícone de imagem quebrada. */
  readonly logosPagamento = [
    { alt: 'Visa', arquivo: 'visa.png' },
    { alt: 'Mastercard', arquivo: 'mastercard.png' },
    { alt: 'Elo', arquivo: 'elo.png' },
    { alt: 'Amex', arquivo: 'amex.png' },
    { alt: 'Hipercard', arquivo: 'hipercard.png' },
    { alt: 'Diners', arquivo: 'diners.png' },
    { alt: 'Pix', arquivo: 'pix.png' },
  ];

  readonly logosEnvio = [
    { alt: 'Correios', arquivo: 'correios.png' },
    { alt: 'Jadlog', arquivo: 'jadlog.png' },
  ];

  atualizarEmailNewsletter(valor: string): void {
    this.emailNewsletter.set(valor);
    this.newsletterEnviada.set(false);
  }

  enviarNewsletter(): void {
    if (!/\S+@\S+\.\S+/.test(this.emailNewsletter())) return;
    // Sem backend ainda — só confirma visualmente o cadastro.
    this.newsletterEnviada.set(true);
    this.emailNewsletter.set('');
  }
}
