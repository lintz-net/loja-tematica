import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

export interface Passo {
  titulo: string;
  texto: string;
}

/** Ícone ilustrativo ao lado do título da seção — só os usados hoje (política de
 * privacidade); adicionar mais conforme necessário em `pagina-institucional.component.html`. */
export type IconeSecao =
  | 'cadeado'
  | 'escudo'
  | 'base-dados'
  | 'compartilhar'
  | 'cookie'
  | 'email'
  | 'coracao'
  | 'estrela';

export interface SecaoInstitucional {
  titulo?: string;
  icone?: IconeSecao;
  paragrafos?: string[];
  lista?: string[];
  passos?: Passo[];
}

export interface DadosPaginaInstitucional {
  titulo: string;
  /** Selo pequeno acima do título (ex.: "Atualizado em..."), pro visual de página de
   * verdade em vez de rascunho — usado na política de privacidade. */
  selo?: string;
  paragrafos?: string[];
  secoes?: SecaoInstitucional[];
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
