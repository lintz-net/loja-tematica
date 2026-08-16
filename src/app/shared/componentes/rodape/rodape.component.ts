import { Component } from '@angular/core';

@Component({
  selector: 'app-rodape',
  standalone: true,
  templateUrl: './rodape.component.html',
  styleUrl: './rodape.component.scss',
})
export class RodapeComponent {
  readonly anoAtual = new Date().getFullYear();
}
