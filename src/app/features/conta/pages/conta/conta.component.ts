import { Component } from '@angular/core';

@Component({
  selector: 'app-conta',
  standalone: true,
  templateUrl: './conta.component.html',
  styleUrl: './conta.component.scss',
})
export class ContaComponent {
  readonly usuarioMock = {
    nome: 'Convidado Fã de Tudo',
    email: 'convidado@vitrinetribal.com.br',
  };
}
