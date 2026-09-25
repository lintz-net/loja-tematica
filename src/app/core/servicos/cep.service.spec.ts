import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { CepService } from './cep.service';

describe('CepService', () => {
  let service: CepService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(CepService);
  });

  it('devolve null sem chamar a API quando o CEP não tem 8 dígitos', (done) => {
    service.buscarEndereco('123').subscribe((endereco) => {
      expect(endereco).toBeNull();
      expect(httpSpy.get).not.toHaveBeenCalled();
      done();
    });
  });

  it('ignora caracteres não numéricos (máscara) antes de validar o tamanho', (done) => {
    httpSpy.get.and.returnValue(
      of({ logradouro: 'Rua das Flores', bairro: 'Centro', localidade: 'São Paulo', uf: 'SP' })
    );

    service.buscarEndereco('01310-100').subscribe((endereco) => {
      expect(httpSpy.get).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
      expect(endereco).toEqual({
        endereco: 'Rua das Flores',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
      });
      done();
    });
  });

  it('devolve null quando o ViaCEP responde com erro (CEP inexistente)', (done) => {
    httpSpy.get.and.returnValue(of({ erro: true, logradouro: '', bairro: '', localidade: '', uf: '' }));

    service.buscarEndereco('99999999').subscribe((endereco) => {
      expect(endereco).toBeNull();
      done();
    });
  });
});
