import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseClienteService } from './supabase.client';

function criarClienteFake() {
  return {
    auth: jasmine.createSpyObj('auth', [
      'getSession',
      'onAuthStateChange',
      'signInWithPassword',
      'signInWithOtp',
      'signOut',
    ]),
  };
}

describe('AuthService', () => {
  let clienteFake: ReturnType<typeof criarClienteFake>;
  let supabaseClienteSpy: jasmine.SpyObj<SupabaseClienteService>;

  function configurar(plataforma: 'browser' | 'server' = 'browser'): AuthService {
    clienteFake.auth.onAuthStateChange.and.returnValue({ data: { subscription: {} } });

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseClienteService, useValue: supabaseClienteSpy },
        { provide: PLATFORM_ID, useValue: plataforma },
      ],
    });
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    clienteFake = criarClienteFake();
    clienteFake.auth.getSession.and.returnValue(Promise.resolve({ data: { session: null } }));
    supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake as never);
  });

  it('no browser, busca a sessão inicial e registra o listener de mudanças', () => {
    configurar('browser');

    expect(clienteFake.auth.getSession).toHaveBeenCalled();
    expect(clienteFake.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it('atualiza sessao/autenticado quando o listener onAuthStateChange dispara', () => {
    const service = configurar('browser');
    const callback = clienteFake.auth.onAuthStateChange.calls.mostRecent().args[0];

    callback('SIGNED_IN', { user: { id: 'u2' } } as never);

    expect(service.autenticado()).toBeTrue();
    expect(service.sessao()).toEqual({ user: { id: 'u2' } } as never);
  });

  it('no servidor (SSR), não toca no cliente Supabase', () => {
    configurar('server');

    expect(clienteFake.auth.getSession).not.toHaveBeenCalled();
    expect(clienteFake.auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('atualiza sessao/autenticado quando getSession resolve com uma sessão', fakeAsync(() => {
    clienteFake.auth.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
    );
    const service = configurar('browser');
    flushMicrotasks();

    expect(service.autenticado()).toBeTrue();
    expect(service.sessao()).toEqual({ user: { id: 'u1' } } as never);
  }));

  describe('entrar', () => {
    it('chama signInWithPassword com email/senha', (done) => {
      clienteFake.auth.signInWithPassword.and.returnValue(Promise.resolve({ error: null }));
      const service = configurar('browser');

      service.entrar('admin@loja.com', '123456').subscribe(() => {
        expect(clienteFake.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'admin@loja.com',
          password: '123456',
        });
        done();
      });
    });

    it('propaga o erro quando as credenciais são inválidas', (done) => {
      clienteFake.auth.signInWithPassword.and.returnValue(
        Promise.resolve({ error: new Error('Invalid credentials') })
      );
      const service = configurar('browser');

      service.entrar('admin@loja.com', 'senha-errada').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('Invalid credentials');
          done();
        },
      });
    });
  });

  describe('entrarComLinkMagico', () => {
    it('chama signInWithOtp com o e-mail e redirect pra /conta', (done) => {
      clienteFake.auth.signInWithOtp.and.returnValue(Promise.resolve({ error: null }));
      const service = configurar('browser');

      service.entrarComLinkMagico('cliente@loja.com').subscribe(() => {
        expect(clienteFake.auth.signInWithOtp).toHaveBeenCalledWith(
          jasmine.objectContaining({ email: 'cliente@loja.com' })
        );
        done();
      });
    });

    it('propaga o erro quando falha', (done) => {
      clienteFake.auth.signInWithOtp.and.returnValue(
        Promise.resolve({ error: new Error('falhou') })
      );
      const service = configurar('browser');

      service.entrarComLinkMagico('cliente@loja.com').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('sair', () => {
    it('faz signOut e limpa a sessão local', (done) => {
      clienteFake.auth.signOut.and.returnValue(Promise.resolve({ error: null }));
      const service = configurar('browser');

      service.sair().subscribe(() => {
        expect(service.sessao()).toBeNull();
        expect(service.autenticado()).toBeFalse();
        done();
      });
    });

    it('propaga o erro quando o signOut falha', (done) => {
      clienteFake.auth.signOut.and.returnValue(Promise.resolve({ error: new Error('falhou') }));
      const service = configurar('browser');

      service.sair().subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
