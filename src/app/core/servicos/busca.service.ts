import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BuscaService {
  private readonly abertaSignal = signal(false);
  private readonly termoSignal = signal('');

  readonly aberta = computed(() => this.abertaSignal());
  readonly termo = computed(() => this.termoSignal());

  abrir(): void {
    this.abertaSignal.set(true);
  }

  fechar(): void {
    this.abertaSignal.set(false);
    this.termoSignal.set('');
  }

  alternar(): void {
    this.abertaSignal.update((atual) => !atual);
    if (!this.abertaSignal()) {
      this.termoSignal.set('');
    }
  }

  atualizarTermo(valor: string): void {
    this.termoSignal.set(valor);
  }
}
