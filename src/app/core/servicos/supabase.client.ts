import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/** Cliente completo (com GoTrue/sessão de login), usado só por AuthService e pelas
 * operações de admin — todas guardadas para rodar apenas no browser (nunca durante SSR),
 * então o RealtimeClient interno (que trava em Node < 22 esperando WebSocket nativo) nunca
 * chega a ser exercitado de verdade. Leitura/escrita pública (catálogo, banners, pedidos)
 * usa REST puro em `supabase-rest.ts`, sem esse cliente. */
let instancia: SupabaseClient | null = null;

export function obterSupabaseClient(): SupabaseClient {
  if (!instancia) {
    instancia = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
  return instancia;
}
