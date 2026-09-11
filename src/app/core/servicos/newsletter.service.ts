import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RespostaCadastro {
  ok: boolean;
  erro?: string;
}

/** Cadastra o e-mail na newsletter via Edge Function `cadastrar-newsletter`, que adiciona o
 * contato numa Audience do Resend — o envio de campanhas em si é feito manualmente pelo
 * painel do Resend, direto pra essa lista. */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly http = inject(HttpClient);

  cadastrar(email: string): Observable<RespostaCadastro> {
    return this.http.post<RespostaCadastro>(
      `${environment.supabaseUrl}/functions/v1/cadastrar-newsletter`,
      { email },
      {
        headers: {
          apikey: environment.supabaseKey,
          Authorization: `Bearer ${environment.supabaseKey}`,
        },
      }
    );
  }
}
