import { Injectable, inject } from '@angular/core';
import { from, map, Observable, shareReplay } from 'rxjs';
import { ConfiguracaoLoja } from '../modelos/configuracao-loja.model';
import { SupabaseRestService } from './supabase-rest.service';
import { obterSupabaseClient } from './supabase.client';

interface LinhaConfiguracaoLoja {
  nome_loja: string;
  descricao_padrao: string;
  email_contato: string;
  whatsapp_numero: string;
  whatsapp_mensagem: string;
  instagram_url: string | null;
  tiktok_url: string | null;
}

function linhaParaConfiguracao(linha: LinhaConfiguracaoLoja): ConfiguracaoLoja {
  return {
    nomeLoja: linha.nome_loja,
    descricaoPadrao: linha.descricao_padrao,
    emailContato: linha.email_contato,
    whatsappNumero: linha.whatsapp_numero,
    whatsappMensagem: linha.whatsapp_mensagem,
    instagramUrl: linha.instagram_url ?? undefined,
    tiktokUrl: linha.tiktok_url ?? undefined,
  };
}

/** Identidade da loja (nome, contato, redes sociais) — vem do banco (tabela
 * `configuracao_loja`, linha única) em vez de hardcoded, pra permitir reaproveitar o mesmo
 * código-fonte em outra loja temática só trocando o conteúdo dessa tabela em outro projeto
 * Supabase. Lido via REST puro (SSR-safe, ver SupabaseRestService) e cacheado em memória —
 * a config não muda durante a vida da aba/requisição. */
@Injectable({ providedIn: 'root' })
export class ConfiguracaoLojaService {
  private readonly rest = inject(SupabaseRestService);

  private readonly configuracao$: Observable<ConfiguracaoLoja> = this.rest
    .select<LinhaConfiguracaoLoja[]>('configuracao_loja', '?select=*&id=eq.loja')
    .pipe(
      map((linhas) => linhaParaConfiguracao(linhas[0])),
      shareReplay(1)
    );

  obter(): Observable<ConfiguracaoLoja> {
    return this.configuracao$;
  }

  /** Só usado em `/admin/config`, atrás de login — RLS restringe update a admin autenticado. */
  atualizar(dados: ConfiguracaoLoja): Observable<ConfiguracaoLoja> {
    const promessa = obterSupabaseClient()
      .from('configuracao_loja')
      .update({
        nome_loja: dados.nomeLoja,
        descricao_padrao: dados.descricaoPadrao,
        email_contato: dados.emailContato,
        whatsapp_numero: dados.whatsappNumero,
        whatsapp_mensagem: dados.whatsappMensagem,
        instagram_url: dados.instagramUrl || null,
        tiktok_url: dados.tiktokUrl || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', 'loja')
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaConfiguracao(data as LinhaConfiguracaoLoja);
      });

    return from(promessa);
  }
}
