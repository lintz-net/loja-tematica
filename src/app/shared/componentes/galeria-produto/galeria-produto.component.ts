import { Component, Input, computed, signal } from '@angular/core';

@Component({
  selector: 'app-galeria-produto',
  standalone: true,
  templateUrl: './galeria-produto.component.html',
  styleUrl: './galeria-produto.component.scss',
})
export class GaleriaProdutoComponent {
  @Input() alt = '';

  private _imagens: string[] = [];
  @Input({ required: true })
  set imagens(valor: string[]) {
    this._imagens = valor;
    this.indiceAtual.set(0);
  }
  get imagens(): string[] {
    return this._imagens;
  }

  /** Permite ao componente pai (ex.: seleção de cor) apontar a imagem principal para um
   * índice específico sem alterar o conjunto de fotos exibido nas miniaturas. */
  @Input()
  set indiceForcado(valor: number | null | undefined) {
    if (valor != null && valor >= 0 && valor < this._imagens.length) {
      this.indiceAtual.set(valor);
    }
  }

  readonly indiceAtual = signal(0);

  readonly imagemAtiva = computed(() => this.imagens[this.indiceAtual()] ?? '');

  readonly zoomAtivo = signal(false);
  readonly posicaoZoom = signal({ x: 50, y: 50 });

  private inicioToqueX = 0;

  ativarZoom(): void {
    this.zoomAtivo.set(true);
  }

  desativarZoom(): void {
    this.zoomAtivo.set(false);
  }

  aoMoverMouse(evento: MouseEvent): void {
    const alvo = evento.currentTarget as HTMLElement;
    const limites = alvo.getBoundingClientRect();
    const x = ((evento.clientX - limites.left) / limites.width) * 100;
    const y = ((evento.clientY - limites.top) / limites.height) * 100;
    this.posicaoZoom.set({ x, y });
  }

  irPara(indice: number): void {
    this.indiceAtual.set(indice);
  }

  anterior(): void {
    this.indiceAtual.update((i) => (i - 1 + this.imagens.length) % this.imagens.length);
  }

  proxima(): void {
    this.indiceAtual.update((i) => (i + 1) % this.imagens.length);
  }

  aoTocarInicio(evento: TouchEvent): void {
    this.inicioToqueX = evento.touches[0].clientX;
  }

  aoTocarFim(evento: TouchEvent): void {
    const deltaX = evento.changedTouches[0].clientX - this.inicioToqueX;
    const distanciaMinima = 40;
    if (Math.abs(deltaX) < distanciaMinima || this.imagens.length < 2) {
      return;
    }
    deltaX > 0 ? this.anterior() : this.proxima();
  }
}
