import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminLoginComponent } from './admin-login.component';
import { AuthService } from '../../../../core/servicos/auth.service';

describe('AdminLoginComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let fixture: ComponentFixture<AdminLoginComponent>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['entrar']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [AdminLoginComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    fixture = TestBed.createComponent(AdminLoginComponent);
    fixture.detectChanges();
  });

  it('atualiza email e senha', () => {
    const comp = fixture.componentInstance;
    comp.atualizarEmail('admin@loja.com');
    comp.atualizarSenha('123456');

    expect(comp.email()).toBe('admin@loja.com');
    expect(comp.senha()).toBe('123456');
  });

  it('faz login e navega pro dashboard quando as credenciais são válidas', () => {
    authServiceSpy.entrar.and.returnValue(of(undefined));
    const comp = fixture.componentInstance;
    comp.atualizarEmail('admin@loja.com');
    comp.atualizarSenha('123456');

    comp.entrar();

    expect(authServiceSpy.entrar).toHaveBeenCalledWith('admin@loja.com', '123456');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    expect(comp.entrando()).toBeFalse();
  });

  it('mostra erro genérico quando as credenciais são inválidas', () => {
    authServiceSpy.entrar.and.returnValue(throwError(() => new Error('Invalid credentials')));
    const comp = fixture.componentInstance;

    comp.entrar();

    expect(comp.erro()).toBe('E-mail ou senha inválidos.');
    expect(comp.entrando()).toBeFalse();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
