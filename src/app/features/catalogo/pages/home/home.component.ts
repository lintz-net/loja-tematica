import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);

  readonly categorias = toSignal(this.catalogoRepositorio.obterCategorias(), {
    initialValue: [],
  });
}
