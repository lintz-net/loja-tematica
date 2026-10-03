import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Campo do form do Secure Fields: `id` é o id do elemento DOM (input normal pros campos que
 * não precisam de iframe — nome, documento — ou o container onde a SDK injeta o iframe pros
 * campos sensíveis — número, validade, CVV). */
interface CampoCardForm {
  id: string;
  placeholder?: string;
}

/** Dados montados pela própria SDK a partir do que o cliente preencheu nos campos (inclusive
 * dentro dos iframes, que a gente nunca lê diretamente) — usados pra chamar nosso backend. */
export interface DadosCardForm {
  token: string;
  paymentMethodId: string;
  issuerId: string;
  cardholderEmail: string;
  amount: string;
  installments: string;
  identificationNumber: string;
  identificationType: string;
}

export interface ConfiguracaoCardForm {
  amount: string;
  /** Secure Fields de verdade: número/validade/CVV ficam dentro de iframes do próprio
   * Mercado Pago — nunca tocam no nosso HTML/JS. É isso que reduz o escopo de PCI DSS de
   * SAQ A-EP pra SAQ A. */
  iframe: true;
  autoMount?: boolean;
  form: {
    id: string;
    cardNumber: CampoCardForm;
    expirationDate: CampoCardForm;
    securityCode: CampoCardForm;
    cardholderName: CampoCardForm;
    issuer: CampoCardForm;
    installments: CampoCardForm;
    identificationType: CampoCardForm;
    identificationNumber: CampoCardForm;
    cardholderEmail: CampoCardForm;
  };
  callbacks: {
    onFormMounted?: (erro?: unknown) => void;
    onCardTokenReceived?: (erro: unknown, token?: { id: string }) => void;
    onSubmit?: (evento: Event) => void;
    onFetching?: (recurso: string) => void;
    onError?: (erro: unknown) => void;
    /** Dispara conforme o cliente digita em cada campo — inclusive os de dentro dos iframes
     * (número, validade, CVV), que a gente nunca lê diretamente. `erro` nulo/undefined
     * significa "válido agora"; `campo` é o nome usado em `form` acima (ex.: 'cardNumber').
     * É assim que validamos os campos do Secure Fields sem nunca ver o valor deles. */
    onValidityChange?: (erro: unknown, campo?: string) => void;
  };
}

export interface CardForm {
  getCardFormData(): DadosCardForm;
  unmount(): void;
}

/** Formato mínimo da SDK.js v2 do Mercado Pago que a gente usa — não existe @types oficial,
 * então só o que é chamado daqui é tipado. */
interface MercadoPagoSdk {
  cardForm(configuracao: ConfiguracaoCardForm): CardForm;
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
