import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LOGOS_PAGAMENTO } from '../../dados/logos-pagamento';
import { LOGOS_TRANSPORTADORA } from '../../dados/logos-transportadora';
import { NewsletterService } from '../../../core/servicos/newsletter.service';

@Component({
  selector: 'app-rodape',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './rodape.component.html',
  styleUrl: './rodape.component.scss',
})
export class RodapeComponent {
  private readonly newsletterService = inject(NewsletterService);

  readonly anoAtual = new Date().getFullYear();

  readonly emailNewsletter = signal('');
  readonly newsletterEnviada = signal(false);
  readonly enviandoNewsletter = signal(false);
  readonly erroNewsletter = signal<string | null>(null);

  readonly logosPagamento = LOGOS_PAGAMENTO;

  readonly logosEnvio = LOGOS_TRANSPORTADORA;

  atualizarEmailNewsletter(valor: string): void {
    this.emailNewsletter.set(valor);
    this.newsletterEnviada.set(false);
    this.erroNewsletter.set(null);
  }

  enviarNewsletter(): void {
    if (!/\S+@\S+\.\S+/.test(this.emailNewsletter())) return;

    this.enviandoNewsletter.set(true);
    this.erroNewsletter.set(null);
    this.newsletterService.cadastrar(this.emailNewsletter()).subscribe({
      next: (resposta) => {
        this.enviandoNewsletter.set(false);
        if (!resposta.ok) {
          this.erroNewsletter.set('Não foi possível cadastrar. Tente novamente.');
          return;
        }
        this.newsletterEnviada.set(true);
        this.emailNewsletter.set('');
      },
      error: () => {
        this.enviandoNewsletter.set(false);
        this.erroNewsletter.set('Não foi possível cadastrar. Tente novamente.');
      },
    });
  }
}
