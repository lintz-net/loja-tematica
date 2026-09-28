import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogoApiService } from './catalogo-api.service';
import { SupabaseRestService } from './supabase-rest.service';
import { Produto } from '../modelos/produto.model';

function linhaProduto(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'prod-2',
    nome: 'Camiseta Relacionada',
    slug: 'camiseta-relacionada',
    descricao: '',
    preco_base: 50,
    categorias: ['geek'],
    imagens: ['foto.webp'],
    imagens_por_cor: null,
    videos: null,
    guia_medidas: null,
    genero: null,
    peso_kg: null,
    altura_cm: null,
    largura_cm: null,
    comprimento_cm: null,
    variantes: [],
    destaque: false,
    ordem_destaque: null,
    preco_promocional: null,
    ...sobrescritas,
  };
}

function produto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Atual',
    slug: 'camiseta-atual',
    descricao: '',
    precoBase: 50,
    categorias: ['geek'],
    imagens: [],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

describe('CatalogoApiService — obterProdutosRelacionados', () => {
  let service: CatalogoApiService;
  let restSpy: jasmine.SpyObj<SupabaseRestService>;

  beforeEach(() => {
    restSpy = jasmine.createSpyObj('SupabaseRestService', ['select']);
    TestBed.configureTestingModule({
      providers: [CatalogoApiService, { provide: SupabaseRestService, useValue: restSpy }],
    });
    service = TestBed.inject(CatalogoApiService);
  });

  it('filtra pela categoria principal do produto, exclui o próprio id e limita o resultado', (done) => {
    restSpy.select.and.returnValue(of([linhaProduto()]));

    service.obterProdutosRelacionados(produto(), 8).subscribe((relacionados) => {
      expect(relacionados.length).toBe(1);
      expect(relacionados[0].slug).toBe('camiseta-relacionada');

      const [, query] = restSpy.select.calls.mostRecent().args;
      expect(query).toContain(`categorias=cs.${encodeURIComponent(JSON.stringify(['geek']))}`);
      expect(query).toContain('id=neq.prod-1');
      expect(query).toContain('limit=8');
      done();
    });
  });

  it('não chama a API quando o produto não tem categoria (sem base pra relacionar)', (done) => {
    service.obterProdutosRelacionados(produto({ categorias: [] })).subscribe((relacionados) => {
      expect(relacionados).toEqual([]);
      expect(restSpy.select).not.toHaveBeenCalled();
      done();
    });
  });
});
