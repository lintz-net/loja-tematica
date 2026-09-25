import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { NotificarEstoqueService } from './notificar-estoque.service';

describe('NotificarEstoqueService', () => {
  let service: NotificarEstoqueService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(NotificarEstoqueService);
  });

  it('chama a Edge Function com a variante e a URL do produto', () => {
    httpSpy.post.and.returnValue(of({}));

    service.notificarReposicao('v1', 'camiseta-batman');

    expect(httpSpy.post).toHaveBeenCalledWith(
      jasmine.stringContaining('/functions/v1/notificar-estoque'),
      jasmine.objectContaining({ varianteId: 'v1', urlProduto: jasmine.stringContaining('/produto/camiseta-batman') }),
      jasmine.any(Object)
    );
  });

  it('não deixa a falha da notificação propagar (fire-and-forget)', () => {
    httpSpy.post.and.returnValue(throwError(() => new Error('falhou')));
    const consoleSpy = spyOn(console, 'error');

    expect(() => service.notificarReposicao('v1', 'camiseta-batman')).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
