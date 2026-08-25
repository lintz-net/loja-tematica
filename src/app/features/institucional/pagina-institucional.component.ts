import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

export interface Passo {
  titulo: string;
  texto: string;
}

export interface DadosPaginaInstitucional {
  titulo: string;
  paragrafos?: string[];
  passos?: Passo[];
  nota?: string;
}

@Component({
  selector: 'app-pagina-institucional',
  standalone: true,
  templateUrl: './pagina-institucional.component.html',
  styleUrl: './pagina-institucional.component.scss',
})
export class PaginaInstitucionalComponent {
  private readonly route = inject(ActivatedRoute);

  readonly dados = this.route.snapshot.data['pagina'] as DadosPaginaInstitucional;
}
