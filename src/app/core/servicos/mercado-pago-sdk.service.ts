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
    /** Preenchida pelo script antifraude deles (ver carregarScriptSeguranca abaixo) — nome
     * fixo da variável global, documentado por eles, não escolhido por nós. */
    MP_DEVICE_SESSION_ID?: string;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const SCRIPT_SEGURANCA_URL = 'https://www.mercadopago.com/v2/security.js';

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

  private promessaScriptSeguranca: Promise<void> | null = null;

  /** Script antifraude deles (device fingerprint) — preenche `window.MP_DEVICE_SESSION_ID`
   * sozinho, sem callback. Carregar cedo (ao entrar no passo de pagamento, não só no clique
   * de pagar) dá tempo do fingerprint ficar pronto antes da cobrança de verdade. Nunca
   * rejeita: falha em carregar esse script (adblock, CSP, instabilidade) não pode impedir o
   * cliente de pagar — só perde a proteção extra, silenciosamente. */
  carregarScriptSeguranca(): Promise<void> {
    if (this.promessaScriptSeguranca) return this.promessaScriptSeguranca;

    this.promessaScriptSeguranca = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SEGURANCA_URL;
      script.setAttribute('view', 'checkout');
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });

    return this.promessaScriptSeguranca;
  }

  /** Lê `window.MP_DEVICE_SESSION_ID` com um polling curto — na prática o valor pode não
   * estar pronto exatamente quando o script termina de carregar (timing observado, não
   * documentado oficialmente). `undefined` é um resultado válido (o pagamento segue sem o
   * header de device id, nunca trava esperando). */
  async obterDeviceId(timeoutMs = 2000): Promise<string | undefined> {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      if (window.MP_DEVICE_SESSION_ID) return window.MP_DEVICE_SESSION_ID;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return window.MP_DEVICE_SESSION_ID;
  }
}
