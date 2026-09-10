import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LOGOS_PAGAMENTO } from '../../dados/logos-pagamento';

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

  readonly logosPagamento = LOGOS_PAGAMENTO;

  readonly logosEnvio = [
    { alt: 'Correios', arquivo: 'correios.webp' },
    { alt: 'Jadlog', arquivo: 'jadlog.webp' },
    { alt: 'Loggi', arquivo: 'loggi.webp' },
    { alt: 'Buslog', arquivo: 'buslog.webp' },
    { alt: 'J&T Express', arquivo: 'jt-express.webp' },
    { alt: 'LATAM Cargo', arquivo: 'latam.webp' },
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
