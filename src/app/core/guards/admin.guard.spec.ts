import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { SupabaseClienteService } from '../servicos/supabase.client';

describe('adminGuard', () => {
  let clienteFake: { auth: jasmine.SpyObj<{ getSession: jasmine.Spy }>; rpc: jasmine.Spy };
  let routerSpy: jasmine.SpyObj<Router>;
  let urlTreeLogin: UrlTree;

  function configurar(plataforma: 'browser' | 'server') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: plataforma },
        { provide: Router, useValue: routerSpy },
        {
          provide: SupabaseClienteService,
          useValue: { obterCliente: () => clienteFake },
        },
      ],
    });
  }

  function rodarGuard(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      Promise.resolve(adminGuard({} as never, {} as never))
    ) as Promise<boolean | UrlTree>;
  }

  beforeEach(() => {
    clienteFake = {
      auth: jasmine.createSpyObj('auth', ['getSession']),
      rpc: jasmine.createSpy('rpc'),
    };
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    urlTreeLogin = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(urlTreeLogin);
  });

  it('redireciona pro login quando roda no servidor (SSR)', async () => {
    configurar('server');

    const resultado = await rodarGuard();

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/admin/login']);
    expect(resultado).toBe(urlTreeLogin);
    expect(clienteFake.auth.getSession).not.toHaveBeenCalled();
  });

  it('redireciona pro login quando não há sessão', async () => {
    configurar('browser');
    clienteFake.auth.getSession.and.returnValue(Promise.resolve({ data: { session: null } }));

    const resultado = await rodarGuard();

    expect(resultado).toBe(urlTreeLogin);
    expect(clienteFake.rpc).not.toHaveBeenCalled();
  });

  it('permite acesso quando há sessão e eh_admin() devolve true', async () => {
    configurar('browser');
    clienteFake.auth.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
    );
    clienteFake.rpc.and.returnValue(Promise.resolve({ data: true, error: null }));

    const resultado = await rodarGuard();

    expect(clienteFake.rpc).toHaveBeenCalledWith('eh_admin');
    expect(resultado).toBeTrue();
  });

  it('redireciona pro login quando há sessão mas não é admin', async () => {
    configurar('browser');
    clienteFake.auth.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
    );
    clienteFake.rpc.and.returnValue(Promise.resolve({ data: false, error: null }));

    const resultado = await rodarGuard();

    expect(resultado).toBe(urlTreeLogin);
  });

  it('redireciona pro login quando eh_admin() falha', async () => {
    configurar('browser');
    clienteFake.auth.getSession.and.returnValue(
      Promise.resolve({ data: { session: { user: { id: 'u1' } } } })
    );
    clienteFake.rpc.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

    const resultado = await rodarGuard();

    expect(resultado).toBe(urlTreeLogin);
  });
});
