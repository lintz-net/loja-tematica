import { isPlatformBrowser } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Banner } from '../../../core/modelos/banner.model';

const INTERVALO_AUTOPLAY_MS = 5000;

@Component({
  selector: 'app-carrossel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './carrossel.component.html',
  styleUrl: './carrossel.component.scss',
})
export class CarrosselComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private _banners: Banner[] = [];
  @Input({ required: true })
  set banners(valor: Banner[]) {
    this._banners = valor;
    this.indiceAtual.set(0);
  }
  get banners(): Banner[] {
    return this._banners;
  }

  readonly indiceAtual = signal(0);

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private inicioToqueX = 0;

  ngOnInit(): void {
    this.iniciarAutoplay();
  }

  ngOnDestroy(): void {
    this.pararAutoplay();
  }

  private iniciarAutoplay(): void {
    this.pararAutoplay();
    if (!this.isBrowser || this.banners.length < 2) return;
    this.temporizador = setInterval(() => this.proximo(), INTERVALO_AUTOPLAY_MS);
  }

  private pararAutoplay(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  irPara(indice: number): void {
    this.indiceAtual.set(indice);
    this.iniciarAutoplay();
  }

  anterior(): void {
    this.indiceAtual.update((i) => (i - 1 + this.banners.length) % this.banners.length);
    this.iniciarAutoplay();
  }

  proximo(): void {
    this.indiceAtual.update((i) => (i + 1) % this.banners.length);
  }

  pausar(): void {
    this.pararAutoplay();
  }

  retomar(): void {
    this.iniciarAutoplay();
  }

  aoTocarInicio(evento: TouchEvent): void {
    this.inicioToqueX = evento.touches[0].clientX;
  }

  aoTocarFim(evento: TouchEvent): void {
    const deltaX = evento.changedTouches[0].clientX - this.inicioToqueX;
    const distanciaMinima = 40;
    if (Math.abs(deltaX) < distanciaMinima || this.banners.length < 2) return;
    deltaX > 0 ? this.anterior() : this.proximo();
  }
}
