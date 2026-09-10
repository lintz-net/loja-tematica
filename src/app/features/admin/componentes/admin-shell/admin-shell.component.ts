import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/servicos/auth.service';

/** Layout compartilhado das telas de admin (pedidos, produtos, formulário de produto) —
 * navegação lateral fixa + botão de sair, em vez de cada página repetir seu próprio
 * cabeçalho. `/admin/login` fica fora disso (não tem sentido mostrar nav antes de logar). */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  sair(): void {
    this.authService.sair().subscribe(() => this.router.navigate(['/admin/login']));
  }
}
