import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AvaliacaoApiService } from './avaliacao-api.service';
import { SupabaseRestService } from './supabase-rest.service';

function linhaAvaliacao(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'aval-1',
    produto_id: 'prod-1',
    nome_cliente: 'Maria',
    nota: 5,
    comentario: 'Ótimo produto',
    criado_em: '2026-01-01T00:00:00.000Z',
    status: 'aprovada',
    ...sobrescritas,
  };
}

describe('AvaliacaoApiService', () => {
  let service: AvaliacaoApiService;
  let restSpy: jasmine.SpyObj<SupabaseRestService>;

  beforeEach(() => {
    restSpy = jasmine.createSpyObj('SupabaseRestService', ['select', 'insert']);
    TestBed.configureTestingModule({
      providers: [AvaliacaoApiService, { provide: SupabaseRestService, useValue: restSpy }],
    });
    service = TestBed.inject(AvaliacaoApiService);
  });

  describe('obterAvaliacoesPorProduto', () => {
    it('busca só avaliações aprovadas do produto, mais recentes primeiro', (done) => {
      restSpy.select.and.returnValue(of([linhaAvaliacao()]));

      service.obterAvaliacoesPorProduto('prod-1').subscribe((avaliacoes) => {
        const [tabela, query] = restSpy.select.calls.mostRecent().args;
        expect(tabela).toBe('avaliacoes');
        expect(query).toContain('produto_id=eq.prod-1');
        expect(query).toContain('status=eq.aprovada');
        expect(query).toContain('order=criado_em.desc');
        expect(avaliacoes).toEqual([
          jasmine.objectContaining({ id: 'aval-1', nomeCliente: 'Maria', status: 'aprovada' }),
        ]);
        done();
      });
    });
  });

  describe('criar', () => {
    it('sempre manda status pendente, independente do que for passado', (done) => {
      restSpy.insert.and.returnValue(of(undefined));

      service
        .criar({ produtoId: 'prod-1', nomeCliente: 'João', nota: 4, comentario: 'Gostei' })
        .subscribe(() => {
          expect(restSpy.insert).toHaveBeenCalledWith(
            'avaliacoes',
            jasmine.objectContaining({
              produto_id: 'prod-1',
              nome_cliente: 'João',
              nota: 4,
              comentario: 'Gostei',
              status: 'pendente',
            })
          );
          done();
        });
    });

    it('manda comentário null quando não informado', (done) => {
      restSpy.insert.and.returnValue(of(undefined));

      service.criar({ produtoId: 'prod-1', nomeCliente: 'João', nota: 4 }).subscribe(() => {
        const [, dados] = restSpy.insert.calls.mostRecent().args;
        expect((dados as { comentario: unknown }).comentario).toBeNull();
        done();
      });
    });
  });
});
