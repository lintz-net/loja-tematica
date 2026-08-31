import { Component, inject, signal } from '@angular/core';
import {
  Event,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

@Component({
  selector: 'app-barra-progresso',
  standalone: true,
  templateUrl: './barra-progresso.component.html',
  styleUrl: './barra-progresso.component.scss',
})
export class BarraProgressoComponent {
  private readonly router = inject(Router);

  readonly ativa = signal(false);

  constructor() {
    this.router.events.subscribe((evento: Event) => {
      if (evento instanceof NavigationStart) {
        this.ativa.set(true);
      } else if (
        evento instanceof NavigationEnd ||
        evento instanceof NavigationCancel ||
        evento instanceof NavigationError
      ) {
        this.ativa.set(false);
      }
    });
  }
}
