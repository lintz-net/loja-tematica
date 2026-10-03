import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { CupomService } from './cupom.service';

describe('CupomService', () => {
  let service: CupomService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(CupomService);
  });

  it('chama a Edge Function de validação com código, itens e e-mail', (done) => {
    httpSpy.post.and.returnValue(
      of({ valido: true, codigo: 'PROMO10', tipoDesconto: 'percentual', valorDesconto: 10, desconto: 5 })
    );
    const itens = [{ produtoId: 'p1', categorias: ['camisetas'], precoUnitario: 50, quantidade: 1 }];

    service.validar('promo10', itens, 'cliente@teste.com').subscribe((resultado) => {
      expect(httpSpy.post).toHaveBeenCalledWith(
        jasmine.stringContaining('/functions/v1/validar-cupom'),
        { codigo: 'promo10', itens, email: 'cliente@teste.com' },
        jasmine.any(Object)
      );
      expect(resultado.valido).toBeTrue();
      done();
    });
  });

  it('manda email undefined quando não informado', (done) => {
    httpSpy.post.and.returnValue(
      of({ valido: true, codigo: 'PROMO10', tipoDesconto: 'percentual', valorDesconto: 10, desconto: 5 })
    );
    const itens = [{ produtoId: 'p1', categorias: [], precoUnitario: 20, quantidade: 2 }];

    service.validar('promo10', itens).subscribe(() => {
      const [, corpo] = httpSpy.post.calls.mostRecent().args;
      expect((corpo as { email?: string }).email).toBeUndefined();
      done();
    });
  });
});
