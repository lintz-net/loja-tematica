import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ItemParaCotacao {
  produtoId: string;
  quantidade: number;
}

export interface OpcaoFrete {
  id: string;
  nome: string;
  prazo: string;
  preco: number;
  transportadora: string;
  servico: string;
  prazoDias: number;
}

interface OpcaoFreteResposta {
  id: number;
  transportadora: string;
  servico: string;
  prazoDias: number;
  preco: number;
}

/** Cotação de frete real via Melhor Envio, através da Edge Function `melhor-envio-cotar`
 * (o Angular nunca chama a API do Melhor Envio direto — client_secret não pode ficar no
 * frontend, e a API deles não é pensada pra ser chamada do browser). */
@Injectable({ providedIn: 'root' })
export class FreteService {
  private readonly http = inject(HttpClient);

  cotar(cepDestino: string, itens: ItemParaCotacao[]): Observable<OpcaoFrete[]> {
    return this.http
      .post<OpcaoFreteResposta[]>(
        `${environment.supabaseUrl}/functions/v1/melhor-envio-cotar`,
        { cepDestino, itens },
        {
          headers: {
            apikey: environment.supabaseKey,
            Authorization: `Bearer ${environment.supabaseKey}`,
          },
        }
      )
      .pipe(
        map((opcoes) =>
          opcoes.map((o) => ({
            id: String(o.id),
            nome: `${o.transportadora} · ${o.servico}`,
            prazo: `${o.prazoDias} dia${o.prazoDias === 1 ? '' : 's'} útil(eis)`,
            preco: o.preco,
            transportadora: o.transportadora,
            servico: o.servico,
            prazoDias: o.prazoDias,
          }))
        )
      );
  }
}
