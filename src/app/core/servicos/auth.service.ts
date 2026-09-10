import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { from, Observable, tap } from 'rxjs';
import { obterSupabaseClient } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sessaoSignal = signal<Session | null>(null);
  readonly sessao = this.sessaoSignal.asReadonly();
  readonly autenticado = signal(false);

  constructor() {
    /** Sessão de admin só faz sentido no browser — evita que o GoTrueClient do Supabase
     * (usa BroadcastChannel/locks do navegador) rode durante o prerender SSR. */
    if (!this.isBrowser) return;

    obterSupabaseClient()
      .auth.getSession()
      .then(({ data }) => this.definirSessao(data.session));

    obterSupabaseClient().auth.onAuthStateChange((_evento, sessao) => {
      this.definirSessao(sessao);
    });
  }

  entrar(email: string, senha: string): Observable<void> {
    const promessa = obterSupabaseClient()
      .auth.signInWithPassword({ email, password: senha })
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }

  /** Login de cliente (`/conta`) via link mágico — sem senha. O cliente recebe um e-mail
   * com um link que, ao ser aberto, autentica sozinho (a sessão é detectada automaticamente
   * pelo cliente Supabase a partir da URL, via `onAuthStateChange`/`getSession` já ligados
   * no construtor). `emailRedirectTo` manda de volta pra `/conta` depois de clicar. */
  entrarComLinkMagico(email: string): Observable<void> {
    const promessa = obterSupabaseClient()
      .auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/conta` },
      })
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa);
  }

  sair(): Observable<void> {
    const promessa = obterSupabaseClient()
      .auth.signOut()
      .then(({ error }) => {
        if (error) throw error;
      });

    return from(promessa).pipe(tap(() => this.definirSessao(null)));
  }

  private definirSessao(sessao: Session | null): void {
    this.sessaoSignal.set(sessao);
    this.autenticado.set(sessao !== null);
  }
}
