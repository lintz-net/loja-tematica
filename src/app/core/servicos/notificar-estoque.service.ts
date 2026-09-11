import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Dispara a Edge Function `notificar-estoque` quando o admin repõe o estoque de uma
 * variante — manda e-mail (Resend) pra quem se inscreveu em "avise-me quando chegar". */
@Injectable({ providedIn: 'root' })
export class NotificarEstoqueService {
  private readonly http = inject(HttpClient);

  notificarReposicao(varianteId: string, produtoSlug: string): void {
    const urlProduto = `${environment.siteUrl}/produto/${produtoSlug}`;
    this.http
      .post(
        `${environment.supabaseUrl}/functions/v1/notificar-estoque`,
        { varianteId, urlProduto },
        {
          headers: {
            apikey: environment.supabaseKey,
            Authorization: `Bearer ${environment.supabaseKey}`,
          },
        }
      )
      // Fire-and-forget: falha em notificar não pode travar o salvamento do produto no admin.
      .subscribe({ error: (erro) => console.error('Falha ao notificar reposição:', erro) });
  }
}
