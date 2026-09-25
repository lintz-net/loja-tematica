import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/** Cliente completo (com GoTrue/sessão de login), usado só por AuthService e pelas
 * operações de admin — todas guardadas para rodar apenas no browser (nunca durante SSR),
 * então o RealtimeClient interno (que trava em Node < 22 esperando WebSocket nativo) nunca
 * chega a ser exercitado de verdade. Leitura/escrita pública (catálogo, banners, pedidos)
 * usa REST puro em `supabase-rest.ts`, sem esse cliente.
 *
 * Injetável (em vez de uma função de módulo solta) pra poder ser substituído por um mock
 * nos testes unitários dos serviços que dependem dele — uma função solta não é mockável
 * depois que o build empacota o módulo como ESM real (binding somente leitura). */
@Injectable({ providedIn: 'root' })
export class SupabaseClienteService {
  private instancia: SupabaseClient | null = null;

  obterCliente(): SupabaseClient {
    if (!this.instancia) {
      this.instancia = createClient(environment.supabaseUrl, environment.supabaseKey);
    }
    return this.instancia;
  }
}
