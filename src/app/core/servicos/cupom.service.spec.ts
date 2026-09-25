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

  it('chama a Edge Function de validação com código e subtotal', (done) => {
    httpSpy.post.and.returnValue(
      of({ valido: true, codigo: 'PROMO10', tipoDesconto: 'percentual', valorDesconto: 10, desconto: 5 })
    );

    service.validar('promo10', 50).subscribe((resultado) => {
      expect(httpSpy.post).toHaveBeenCalledWith(
        jasmine.stringContaining('/functions/v1/validar-cupom'),
        { codigo: 'promo10', subtotal: 50 },
        jasmine.any(Object)
      );
      expect(resultado.valido).toBeTrue();
      done();
    });
  });
});
