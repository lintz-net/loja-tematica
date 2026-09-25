import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { FreteService } from './frete.service';

describe('FreteService', () => {
  let service: FreteService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(FreteService);
  });

  it('mapeia as opções da Edge Function, montando nome e prazo formatados', (done) => {
    httpSpy.post.and.returnValue(
      of([
        { id: 1, transportadora: 'Correios', servico: 'PAC', prazoDias: 5, preco: 25.9 },
        { id: 2, transportadora: 'Jadlog', servico: 'Expresso', prazoDias: 1, preco: 39.9 },
      ])
    );

    service.cotar('01310-100', [{ produtoId: 'p1', quantidade: 1 }]).subscribe((opcoes) => {
      expect(httpSpy.post).toHaveBeenCalledWith(
        jasmine.stringContaining('/functions/v1/melhor-envio-cotar'),
        { cepDestino: '01310-100', itens: [{ produtoId: 'p1', quantidade: 1 }] },
        jasmine.any(Object)
      );
      expect(opcoes[0]).toEqual(
        jasmine.objectContaining({ id: '1', nome: 'Correios · PAC', prazo: '5 dias útil(eis)' })
      );
      expect(opcoes[1].prazo).toBe('1 dia útil(eis)');
      done();
    });
  });
});
