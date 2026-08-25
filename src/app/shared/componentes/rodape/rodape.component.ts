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

  readonly bandeiras = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Diners'];

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
