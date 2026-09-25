import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { SupabaseRestService } from './supabase-rest.service';

describe('SupabaseRestService', () => {
  let service: SupabaseRestService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(SupabaseRestService);
  });

  it('select faz GET na tabela com os headers de autenticação', (done) => {
    httpSpy.get.and.returnValue(of([{ id: 1 }]));

    service.select('produtos', '?select=*').subscribe((dados) => {
      expect(httpSpy.get).toHaveBeenCalledWith(
        jasmine.stringContaining('/rest/v1/produtos?select=*'),
        jasmine.any(Object)
      );
      expect(dados).toEqual([{ id: 1 }]);
      done();
    });
  });

  it('rpc faz POST na função com os argumentos', (done) => {
    httpSpy.post.and.returnValue(of([{ ok: true }]));

    service.rpc('eh_admin', { p_id: 'u1' }).subscribe((dados) => {
      expect(httpSpy.post).toHaveBeenCalledWith(
        jasmine.stringContaining('/rest/v1/rpc/eh_admin'),
        { p_id: 'u1' },
        jasmine.any(Object)
      );
      expect(dados).toEqual([{ ok: true }]);
      done();
    });
  });

  it('insert faz POST com Prefer: return=minimal e devolve void', (done) => {
    httpSpy.post.and.returnValue(of(''));

    service.insert('pedidos', { codigo: 'VT-1' }).subscribe((resultado) => {
      expect(httpSpy.post).toHaveBeenCalled();
      const args = httpSpy.post.calls.mostRecent().args;
      const opcoes = args[2] as { headers: { get: (n: string) => string } };
      expect(opcoes.headers.get('Prefer')).toBe('return=minimal');
      expect(resultado).toBeUndefined();
      done();
    });
  });
});
