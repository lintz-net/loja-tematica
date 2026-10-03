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

export interface ItemCupom {
  produtoId: string;
  categorias: string[];
  precoUnitario: number;
  quantidade: number;
}

/** Valida cupom no checkout via Edge Function `validar-cupom` — a tabela `cupons` só é
 * legível por admin (RLS), então a validação de verdade acontece do lado do servidor, nunca
 * por um select direto do navegador. Manda os itens do carrinho (não um subtotal pronto),
 * já que o desconto pode incidir só sobre parte deles (cupom restrito por categoria/produto). */
@Injectable({ providedIn: 'root' })
export class CupomService {
  private readonly http = inject(HttpClient);

  validar(codigo: string, itens: ItemCupom[], email?: string): Observable<ResultadoCupom> {
    return this.http.post<ResultadoCupom>(
      `${environment.supabaseUrl}/functions/v1/validar-cupom`,
      { codigo, itens, email },
      {
        headers: {
          apikey: environment.supabaseKey,
          Authorization: `Bearer ${environment.supabaseKey}`,
        },
      }
    );
  }
}
