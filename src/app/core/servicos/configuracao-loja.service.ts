import { Injectable, inject, signal } from '@angular/core';
import { from, map, Observable, tap } from 'rxjs';
import { CidadeFreteGratis, ConfiguracaoLoja } from '../modelos/configuracao-loja.model';
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
  cidades_frete_gratis: CidadeFreteGratis[] | null;
  mensagens_barra_anuncio: string[] | null;
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
    cidadesFreteGratis: linha.cidades_frete_gratis ?? [],
    mensagensBarraAnuncio: linha.mensagens_barra_anuncio ?? [],
  };
}

/** Identidade da loja (nome, contato, redes sociais) — vem do banco (tabela
 * `configuracao_loja`, linha única) em vez de hardcoded, pra permitir reaproveitar o mesmo
 * código-fonte em outra loja temática só trocando o conteúdo dessa tabela em outro projeto
 * Supabase.
 *
 * Buscada uma única vez, no `APP_INITIALIZER` (ver `app.config.ts`), antes do app terminar de
 * inicializar — os consumidores (rodapé, cabeçalho, WhatsApp flutuante, home, admin-shell,
 * SeoService) só leem o signal `configuracao`, já resolvido, em vez de cada um assinar sua
 * própria busca assíncrona. Com 5+ componentes fazendo isso de forma independente, o tempo
 * até o app "estabilizar" (`ApplicationRef.isStable()`) cresce, e em conjunto com tráfego de
 * fundo alheio ao app (ex.: extensões do navegador que ficam fazendo polling na página) pode
 * estourar o timeout de hidratação do Angular (NG0506), causando conteúdo duplicado na tela. */
@Injectable({ providedIn: 'root' })
export class ConfiguracaoLojaService {
  private readonly rest = inject(SupabaseRestService);

  private readonly _configuracao = signal<ConfiguracaoLoja | null>(null);
  readonly configuracao = this._configuracao.asReadonly();

  /** URL de `wa.me` com número/mensagem da loja — usada tanto pelo botão flutuante quanto
   * pelo item "Contato" do cabeçalho, pra não duplicar essa montagem em dois lugares. */
  linkWhatsapp(): string {
    const configuracao = this._configuracao();
    if (!configuracao) return '';
    return `https://wa.me/${configuracao.whatsappNumero}?text=${encodeURIComponent(configuracao.whatsappMensagem)}`;
  }

  /** Chamado uma única vez pelo `APP_INITIALIZER`. */
  carregarInicial(): Observable<ConfiguracaoLoja> {
    return this.rest
      .select<LinhaConfiguracaoLoja[]>('configuracao_loja', '?select=*&id=eq.loja')
      .pipe(
        map((linhas) => linhaParaConfiguracao(linhas[0])),
        tap((configuracao) => this._configuracao.set(configuracao))
      );
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
        cidades_frete_gratis: dados.cidadesFreteGratis,
        mensagens_barra_anuncio: dados.mensagensBarraAnuncio,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', 'loja')
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return linhaParaConfiguracao(data as LinhaConfiguracaoLoja);
      });

    return from(promessa).pipe(tap((configuracao) => this._configuracao.set(configuracao)));
  }
}
