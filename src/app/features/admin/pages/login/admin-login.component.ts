import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/servicos/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly senha = signal('');
  readonly entrando = signal(false);
  readonly erro = signal<string | null>(null);

  atualizarEmail(valor: string): void {
    this.email.set(valor);
  }

  atualizarSenha(valor: string): void {
    this.senha.set(valor);
  }

  entrar(): void {
    this.entrando.set(true);
    this.erro.set(null);

    this.authService.entrar(this.email(), this.senha()).subscribe({
      next: () => {
        this.entrando.set(false);
        this.router.navigate(['/admin/pedidos']);
      },
      error: () => {
        this.entrando.set(false);
        this.erro.set('E-mail ou senha inválidos.');
      },
    });
  }
}
