import { Component, inject, signal } from '@angular/core';
import { Banner, DestinoBanner } from '../../../../core/modelos/banner.model';
import { AdminBannerService } from '../../../../core/servicos/admin-banner.service';

@Component({
  selector: 'app-admin-banners',
  standalone: true,
  templateUrl: './admin-banners.component.html',
  styleUrl: './admin-banners.component.scss',
})
export class AdminBannersComponent {
  private readonly adminBannerService = inject(AdminBannerService);

  readonly carregando = signal(true);
  readonly banners = signal<Banner[]>([]);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly enviandoImagem = signal(false);
  readonly idExcluindo = signal<string | null>(null);

  // Formulário de novo banner
  readonly novaImagemUrl = signal('');
  readonly novoAlt = signal('');
  readonly novoLink = signal('');
  readonly novoDestino = signal<DestinoBanner>('home');
  readonly novaOrdem = signal(0);

  readonly podeCriar = (): boolean =>
    this.novaImagemUrl().trim().length > 0 &&
    this.novoAlt().trim().length > 0 &&
    !this.enviandoImagem();

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.adminBannerService.listar().subscribe({
      next: (banners) => {
        this.banners.set(banners);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os banners.');
        this.carregando.set(false);
      },
    });
  }

  aoSelecionarImagem(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    this.enviandoImagem.set(true);
    this.adminBannerService.enviarImagem(arquivo).subscribe({
      next: (url) => {
        this.novaImagemUrl.set(url);
        this.enviandoImagem.set(false);
      },
      error: () => {
        this.erro.set('Falha ao enviar a imagem do banner.');
        this.enviandoImagem.set(false);
      },
    });
    input.value = '';
  }

  atualizarNovoDestino(valor: string): void {
    this.novoDestino.set(valor as DestinoBanner);
  }

  atualizarNovaOrdem(valor: string): void {
    this.novaOrdem.set(Number(valor) || 0);
  }

  criarBanner(): void {
    if (!this.podeCriar()) return;

    this.salvando.set(true);
    this.erro.set(null);
    this.adminBannerService
      .criar({
        imagemUrl: this.novaImagemUrl().trim(),
        alt: this.novoAlt().trim(),
        link: this.novoLink().trim() || undefined,
        destino: this.novoDestino(),
        ordem: this.novaOrdem(),
      })
      .subscribe({
        next: (banner) => {
          this.banners.update((atual) => [...atual, banner]);
          this.salvando.set(false);
          this.novaImagemUrl.set('');
          this.novoAlt.set('');
          this.novoLink.set('');
          this.novoDestino.set('home');
          this.novaOrdem.set(0);
        },
        error: () => {
          this.salvando.set(false);
          this.erro.set('Não foi possível criar o banner.');
        },
      });
  }

  remover(banner: Banner): void {
    if (!confirm(`Excluir este banner? Essa ação não pode ser desfeita.`)) return;

    this.idExcluindo.set(banner.id);
    this.adminBannerService.remover(banner.id).subscribe({
      next: () => {
        this.banners.update((atual) => atual.filter((b) => b.id !== banner.id));
        this.idExcluindo.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível excluir o banner.');
        this.idExcluindo.set(null);
      },
    });
  }
}
