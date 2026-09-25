import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Formato mínimo da SDK.js v2 do Mercado Pago que a gente usa — não existe @types oficial,
 * então só o que é chamado daqui é tipado. */
interface MercadoPagoSdk {
  getPaymentMethods(opcoes: { bin: string }): Promise<{
    results: Array<{ id: string; name: string }>;
  }>;
  getIssuers(opcoes: { paymentMethodId: string; bin: string }): Promise<
    Array<{ id: string; name: string }>
  >;
  createCardToken(dados: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ id: string; status: string }>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opcoes?: { locale?: string }) => MercadoPagoSdk;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

/** Carrega a SDK.js do Mercado Pago (tokenização de cartão no navegador — número/CVV nunca
 * passam pelo nosso backend) só quando o cliente escolhe pagar com cartão no checkout, não em
 * toda visita à loja. */
@Injectable({ providedIn: 'root' })
export class MercadoPagoSdkService {
  private promessaCarregamento: Promise<MercadoPagoSdk> | null = null;

  carregar(): Promise<MercadoPagoSdk> {
    if (this.promessaCarregamento) return this.promessaCarregamento;

    this.promessaCarregamento = new Promise((resolve, reject) => {
      if (window.MercadoPago) {
        resolve(new window.MercadoPago(environment.mercadoPagoPublicKey, { locale: 'pt-BR' }));
        return;
      }

      const script = document.createElement('script');
      script.src = SDK_URL;
      script.onload = () => {
        if (!window.MercadoPago) {
          reject(new Error('SDK do Mercado Pago carregou mas não expôs window.MercadoPago.'));
          return;
        }
        resolve(new window.MercadoPago(environment.mercadoPagoPublicKey, { locale: 'pt-BR' }));
      };
      script.onerror = () => reject(new Error('Falha ao carregar a SDK do Mercado Pago.'));
      document.head.appendChild(script);
    });

    return this.promessaCarregamento;
  }
}
