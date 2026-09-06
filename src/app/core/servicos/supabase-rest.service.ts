import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Chamadas diretas à API REST (PostgREST) do Supabase via `HttpClient`, sem passar pelo
 * cliente `@supabase/supabase-js` completo — que sempre inicializa GoTrue + Realtime junto
 * (mesmo sem nunca usar login ou canais), e cujo RealtimeClient trava indefinidamente em
 * Node < 22 ao tentar sincronizar o token de auth. Usa `HttpClient` (não `fetch` puro): o
 * Zone.js não rastreia `fetch` nativo no Node, então a página seria serializada no SSR
 * antes da resposta chegar — `HttpClient` usa `xhr2` no servidor, que a zona rastreia
 * corretamente. Usado pelos serviços que só leem/escrevem tabelas (catálogo, banners,
 * pedidos) — nada aqui depende de sessão de usuário. `AuthService`/admin continuam usando o
 * cliente completo, mas só rodam no browser (nunca durante SSR). */
@Injectable({ providedIn: 'root' })
export class SupabaseRestService {
  private readonly http = inject(HttpClient);

  private readonly headers = new HttpHeaders({
    apikey: environment.supabaseKey,
    Authorization: `Bearer ${environment.supabaseKey}`,
    'Content-Type': 'application/json',
  });

  select<T>(tabela: string, query = ''): Observable<T> {
    return this.http.get<T>(`${environment.supabaseUrl}/rest/v1/${tabela}${query}`, {
      headers: this.headers,
    });
  }

  rpc<T>(funcao: string, args: Record<string, unknown>): Observable<T> {
    return this.http.post<T>(`${environment.supabaseUrl}/rest/v1/rpc/${funcao}`, args, {
      headers: this.headers,
    });
  }

  /** `return=minimal` faz o PostgREST devolver corpo vazio — pede resposta como texto pra
   * não quebrar tentando fazer parse de JSON vazio. */
  insert(tabela: string, dados: unknown): Observable<void> {
    return this.http
      .post(`${environment.supabaseUrl}/rest/v1/${tabela}`, dados, {
        headers: this.headers.set('Prefer', 'return=minimal'),
        responseType: 'text',
      })
      .pipe(map(() => undefined));
  }
}
