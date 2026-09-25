import { TestBed } from '@angular/core/testing';
import { MercadoPagoSdkService } from './mercado-pago-sdk.service';

describe('MercadoPagoSdkService', () => {
  let service: MercadoPagoSdkService;
  let mercadoPagoOriginal: Window['MercadoPago'];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MercadoPagoSdkService);
    mercadoPagoOriginal = window.MercadoPago;
  });

  afterEach(() => {
    window.MercadoPago = mercadoPagoOriginal;
  });

  it('resolve direto (sem inserir script) quando window.MercadoPago já existe', async () => {
    const instanciaFake = {} as InstanceType<NonNullable<Window['MercadoPago']>>;
    const construtorFake = jasmine.createSpy('MercadoPago').and.returnValue(instanciaFake);
    window.MercadoPago = construtorFake as unknown as Window['MercadoPago'];
    const createElementSpy = spyOn(document, 'createElement').and.callThrough();

    const sdk = await service.carregar();

    expect(sdk).toBe(instanciaFake);
    expect(createElementSpy).not.toHaveBeenCalledWith('script');
  });

  it('insere o script da SDK e resolve quando ele carrega com sucesso', async () => {
    window.MercadoPago = undefined;
    const scriptFake = document.createElement('script');
    spyOn(document, 'createElement').and.returnValue(scriptFake);
    const appendSpy = spyOn(document.head, 'appendChild').and.callFake((node) => {
      const instanciaFake = {} as InstanceType<NonNullable<Window['MercadoPago']>>;
      window.MercadoPago = jasmine
        .createSpy('MercadoPago')
        .and.returnValue(instanciaFake) as unknown as Window['MercadoPago'];
      scriptFake.onload?.(new Event('load'));
      return node;
    });

    const sdk = await service.carregar();

    expect(sdk).toBeTruthy();
    expect(appendSpy).toHaveBeenCalled();
    expect(scriptFake.src).toBe('https://sdk.mercadopago.com/js/v2');
  });

  it('rejeita quando o script carrega mas não expõe window.MercadoPago', async () => {
    window.MercadoPago = undefined;
    const scriptFake = document.createElement('script');
    spyOn(document, 'createElement').and.returnValue(scriptFake);
    spyOn(document.head, 'appendChild').and.callFake((node) => {
      scriptFake.onload?.(new Event('load'));
      return node;
    });

    await expectAsync(service.carregar()).toBeRejectedWithError(
      'SDK do Mercado Pago carregou mas não expôs window.MercadoPago.'
    );
  });

  it('rejeita quando o script falha ao carregar', async () => {
    window.MercadoPago = undefined;
    const scriptFake = document.createElement('script');
    spyOn(document, 'createElement').and.returnValue(scriptFake);
    spyOn(document.head, 'appendChild').and.callFake((node) => {
      scriptFake.onerror?.(new Event('error'));
      return node;
    });

    await expectAsync(service.carregar()).toBeRejectedWithError(
      'Falha ao carregar a SDK do Mercado Pago.'
    );
  });

  it('reusa a mesma promessa em chamadas subsequentes (não insere o script duas vezes)', async () => {
    const instanciaFake = {} as InstanceType<NonNullable<Window['MercadoPago']>>;
    window.MercadoPago = jasmine
      .createSpy('MercadoPago')
      .and.returnValue(instanciaFake) as unknown as Window['MercadoPago'];

    const primeira = service.carregar();
    const segunda = service.carregar();

    expect(primeira).toBe(segunda);
    await primeira;
  });
});
