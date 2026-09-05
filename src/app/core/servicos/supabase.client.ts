import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/** Criado sob demanda (não no import do módulo) porque a inicialização do cliente Supabase
 * dispara o RealtimeClient, que exige um `WebSocket` global — indisponível durante o
 * prerender SSR (Node sem WebSocket nativo). Como nada aqui usa realtime, criar o cliente
 * só quando o serviço realmente for chamado evita esse import ser avaliado no build do servidor. */
let instancia: SupabaseClient | null = null;

export function obterSupabaseClient(): SupabaseClient {
  if (!instancia) {
    instancia = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
  return instancia;
}
