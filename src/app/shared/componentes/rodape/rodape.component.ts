import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LOGOS_PAGAMENTO } from '../../dados/logos-pagamento';
import { LOGOS_TRANSPORTADORA } from '../../dados/logos-transportadora';

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

  readonly logosEnvio = LOGOS_TRANSPORTADORA;

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
