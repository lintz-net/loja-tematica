import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CupomValido {
  valido: true;
  codigo: string;
  tipoDesconto: 'percentual' | 'valor_fixo';
  valorDesconto: number;
  desconto: number;
}

export interface CupomInvalido {
  valido: false;
  motivo: string;
}

export type ResultadoCupom = CupomValido | CupomInvalido;

/** Valida cupom no checkout via Edge Function `validar-cupom` — a tabela `cupons` só é
 * legível por admin (RLS), então a validação de verdade acontece do lado do servidor, nunca
 * por um select direto do navegador. */
@Injectable({ providedIn: 'root' })
export class CupomService {
  private readonly http = inject(HttpClient);

  validar(codigo: string, subtotal: number): Observable<ResultadoCupom> {
    return this.http.post<ResultadoCupom>(
      `${environment.supabaseUrl}/functions/v1/validar-cupom`,
      { codigo, subtotal },
      {
        headers: {
          apikey: environment.supabaseKey,
          Authorization: `Bearer ${environment.supabaseKey}`,
        },
      }
    );
  }
}
