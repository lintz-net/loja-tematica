import { TestBed } from '@angular/core/testing';
import { MercadoPagoSdkService } from './mercado-pago-sdk.service';

describe('MercadoPagoSdkService', () => {
  let service: MercadoPagoSdkService;
  let mercadoPagoOriginal: Window['MercadoPago'];
  let deviceIdOriginal: string | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MercadoPagoSdkService);
    mercadoPagoOriginal = window.MercadoPago;
    deviceIdOriginal = window.MP_DEVICE_SESSION_ID;
  });

  afterEach(() => {
    window.MercadoPago = mercadoPagoOriginal;
    window.MP_DEVICE_SESSION_ID = deviceIdOriginal;
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

  describe('carregarScriptSeguranca', () => {
    it('insere o script antifraude com o atributo view="checkout"', async () => {
      const scriptFake = document.createElement('script');
      spyOn(document, 'createElement').and.returnValue(scriptFake);
      spyOn(document.head, 'appendChild').and.callFake((node) => {
        scriptFake.onload?.(new Event('load'));
        return node;
      });

      await service.carregarScriptSeguranca();

      expect(scriptFake.src).toBe('https://www.mercadopago.com/v2/security.js');
      expect(scriptFake.getAttribute('view')).toBe('checkout');
    });

    it('resolve (não rejeita) mesmo quando o script falha ao carregar', async () => {
      const scriptFake = document.createElement('script');
      spyOn(document, 'createElement').and.returnValue(scriptFake);
      spyOn(document.head, 'appendChild').and.callFake((node) => {
        scriptFake.onerror?.(new Event('error'));
        return node;
      });

      await expectAsync(service.carregarScriptSeguranca()).toBeResolved();
    });

    it('reusa a mesma promessa em chamadas subsequentes (não insere o script duas vezes)', async () => {
      const scriptFake = document.createElement('script');
      spyOn(document, 'createElement').and.returnValue(scriptFake);
      const appendSpy = spyOn(document.head, 'appendChild').and.callFake((node) => {
        scriptFake.onload?.(new Event('load'));
        return node;
      });

      await service.carregarScriptSeguranca();
      await service.carregarScriptSeguranca();

      expect(appendSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('obterDeviceId', () => {
    it('devolve o device id assim que window.MP_DEVICE_SESSION_ID é preenchido', async () => {
      window.MP_DEVICE_SESSION_ID = 'device-123';

      const deviceId = await service.obterDeviceId();

      expect(deviceId).toBe('device-123');
    });

    it('devolve undefined (sem lançar erro) quando o timeout expira sem o valor aparecer', async () => {
      window.MP_DEVICE_SESSION_ID = undefined;

      const deviceId = await service.obterDeviceId(150);

      expect(deviceId).toBeUndefined();
    });
  });
});
