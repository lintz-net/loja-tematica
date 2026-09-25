import { TestBed } from '@angular/core/testing';
import { SupabaseClienteService } from './supabase.client';

describe('SupabaseClienteService', () => {
  it('cria o cliente na primeira chamada e reutiliza a mesma instância depois (singleton)', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(SupabaseClienteService);

    const primeiro = service.obterCliente();
    const segundo = service.obterCliente();

    expect(primeiro).toBeTruthy();
    expect(primeiro).toBe(segundo);
  });
});
