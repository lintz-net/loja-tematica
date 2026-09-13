import { Component, inject, signal } from '@angular/core';
import { ConfiguracaoLoja } from '../../../../core/modelos/configuracao-loja.model';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';

/** Identidade da loja (nome, contato, redes sociais) — o que hoje aparece no título das
 * páginas, no rodapé, no botão de WhatsApp e no painel admin. Editar aqui é o que permite
 * reaproveitar o mesmo código-fonte em outra loja temática (cada uma com seu próprio
 * projeto Supabase) só trocando esses valores, sem mexer em código. */
@Component({
  selector: 'app-admin-config',
  standalone: true,
  templateUrl: './admin-config.component.html',
  styleUrl: './admin-config.component.scss',
})
export class AdminConfigComponent {
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);

  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly salvo = signal(false);

  // Já resolvido pelo APP_INITIALIZER (ver app.config.ts) antes de qualquer componente rodar.
  private readonly configuracaoAtual = this.configuracaoLojaService.configuracao()!;

  readonly nomeLoja = signal(this.configuracaoAtual.nomeLoja);
  readonly descricaoPadrao = signal(this.configuracaoAtual.descricaoPadrao);
  readonly emailContato = signal(this.configuracaoAtual.emailContato);
  readonly whatsappNumero = signal(this.configuracaoAtual.whatsappNumero);
  readonly whatsappMensagem = signal(this.configuracaoAtual.whatsappMensagem);
  readonly instagramUrl = signal(this.configuracaoAtual.instagramUrl ?? '');
  readonly tiktokUrl = signal(this.configuracaoAtual.tiktokUrl ?? '');

  readonly podeSalvar = (): boolean =>
    this.nomeLoja().trim().length > 0 &&
    this.descricaoPadrao().trim().length > 0 &&
    /\S+@\S+\.\S+/.test(this.emailContato()) &&
    this.whatsappNumero().replace(/\D/g, '').length >= 10 &&
    this.whatsappMensagem().trim().length > 0;

  salvar(): void {
    if (!this.podeSalvar()) return;

    const dados: ConfiguracaoLoja = {
      nomeLoja: this.nomeLoja().trim(),
      descricaoPadrao: this.descricaoPadrao().trim(),
      emailContato: this.emailContato().trim(),
      whatsappNumero: this.whatsappNumero().replace(/\D/g, ''),
      whatsappMensagem: this.whatsappMensagem().trim(),
      instagramUrl: this.instagramUrl().trim() || undefined,
      tiktokUrl: this.tiktokUrl().trim() || undefined,
    };

    this.salvando.set(true);
    this.erro.set(null);
    this.salvo.set(false);
    this.configuracaoLojaService.atualizar(dados).subscribe({
      next: () => {
        this.salvando.set(false);
        this.salvo.set(true);
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Não foi possível salvar a configuração.');
      },
    });
  }
}
