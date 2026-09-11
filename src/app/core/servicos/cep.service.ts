import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';

export interface EnderecoPorCep {
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface RespostaViaCep {
  erro?: boolean;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/** Busca endereço por CEP na API pública do ViaCEP (sem chave/custo) — usado pra preencher
 * automaticamente rua/bairro/cidade/UF no checkout, sobrando só o número pro cliente digitar. */
@Injectable({ providedIn: 'root' })
export class CepService {
  private readonly http = inject(HttpClient);

  buscarEndereco(cep: string): Observable<EnderecoPorCep | null> {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return of(null);

    return this.http.get<RespostaViaCep>(`https://viacep.com.br/ws/${cepLimpo}/json/`).pipe(
      map((resposta) => {
        if (resposta.erro) return null;
        return {
          endereco: resposta.logradouro,
          bairro: resposta.bairro,
          cidade: resposta.localidade,
          uf: resposta.uf,
        };
      })
    );
  }
}
