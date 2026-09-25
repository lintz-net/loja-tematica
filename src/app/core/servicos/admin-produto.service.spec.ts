import { TestBed } from '@angular/core/testing';
import { AdminProdutoService } from './admin-produto.service';
import { SupabaseClienteService } from './supabase.client';
import { Produto } from '../modelos/produto.model';

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Batman',
    slug: 'camiseta-batman',
    descricao: 'Descrição',
    precoBase: 50,
    categorias: ['geek'],
    imagens: ['/foto1.webp'],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

function linhaProduto() {
  return {
    id: 'prod-1',
    nome: 'Camiseta Batman',
    slug: 'camiseta-batman',
    descricao: 'Descrição',
    preco_base: 50,
    categorias: ['geek'],
    imagens: ['/foto1.webp'],
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
  };
}

describe('AdminProdutoService', () => {
  let service: AdminProdutoService;
  let clienteFake: {
    from: jasmine.Spy;
    storage: { from: jasmine.Spy };
  };
  let tabelaFake: jasmine.SpyObj<{
    select: jasmine.Spy;
    insert: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
    eq: jasmine.Spy;
    single: jasmine.Spy;
    maybeSingle: jasmine.Spy;
  }>;

  beforeEach(() => {
    tabelaFake = jasmine.createSpyObj('tabela', [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'single',
      'maybeSingle',
    ]);
    tabelaFake.select.and.returnValue(tabelaFake);
    tabelaFake.insert.and.returnValue(tabelaFake);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.delete.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);

    clienteFake = {
      from: jasmine.createSpy('from').and.returnValue(tabelaFake),
      storage: { from: jasmine.createSpy('storageFrom') },
    };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseClienteService, useValue: supabaseClienteSpy }],
    });
    service = TestBed.inject(AdminProdutoService);
  });

  describe('obterPorId', () => {
    it('mapeia a linha (snake_case) pro Produto (camelCase)', (done) => {
      tabelaFake.maybeSingle.and.returnValue(Promise.resolve({ data: linhaProduto(), error: null }));

      service.obterPorId('prod-1').subscribe((produto) => {
        expect(clienteFake.from).toHaveBeenCalledWith('produtos');
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'prod-1');
        expect(produto).toEqual(jasmine.objectContaining({ id: 'prod-1', precoBase: 50 }));
        done();
      });
    });

    it('devolve undefined quando não encontra o produto', (done) => {
      tabelaFake.maybeSingle.and.returnValue(Promise.resolve({ data: null, error: null }));

      service.obterPorId('inexistente').subscribe((produto) => {
        expect(produto).toBeUndefined();
        done();
      });
    });

    it('propaga o erro quando a query falha', (done) => {
      tabelaFake.maybeSingle.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.obterPorId('prod-1').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('criar', () => {
    it('insere a linha em snake_case e devolve o produto mapeado', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaProduto(), error: null }));

      service.criar(criarProduto()).subscribe((produto) => {
        expect(tabelaFake.insert).toHaveBeenCalledWith(
          jasmine.objectContaining({ id: 'prod-1', preco_base: 50 })
        );
        expect(produto.nome).toBe('Camiseta Batman');
        done();
      });
    });

    it('propaga o erro quando o insert falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('duplicate key') })
      );

      service.criar(criarProduto()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('duplicate key');
          done();
        },
      });
    });
  });

  describe('atualizar', () => {
    it('atualiza pelo id e devolve o produto mapeado', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaProduto(), error: null }));

      service.atualizar(criarProduto()).subscribe((produto) => {
        expect(tabelaFake.update).toHaveBeenCalledWith(
          jasmine.objectContaining({ id: 'prod-1' })
        );
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'prod-1');
        expect(produto.slug).toBe('camiseta-batman');
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.atualizar(criarProduto()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('excluir', () => {
    it('exclui pelo id', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: null }));

      service.excluir('prod-1').subscribe(() => {
        expect(tabelaFake.delete).toHaveBeenCalled();
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'prod-1');
        done();
      });
    });

    it('propaga o erro quando a exclusão falha', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: new Error('falhou') }));

      service.excluir('prod-1').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('enviarImagem / enviarVideo', () => {
    it('sobe o arquivo pro Storage e devolve a URL pública', (done) => {
      const bucketFake = jasmine.createSpyObj('bucket', ['upload', 'getPublicUrl']);
      bucketFake.upload.and.returnValue(Promise.resolve({ error: null }));
      bucketFake.getPublicUrl.and.returnValue({ data: { publicUrl: 'https://cdn/x.webp' } });
      clienteFake.storage.from.and.returnValue(bucketFake);
      const arquivo = new File(['x'], 'foto.webp');

      service.enviarImagem('camiseta-batman', arquivo).subscribe((url) => {
        expect(clienteFake.storage.from).toHaveBeenCalledWith('produtos');
        expect(bucketFake.upload).toHaveBeenCalled();
        expect(url).toBe('https://cdn/x.webp');
        done();
      });
    });

    it('propaga o erro quando o upload falha', (done) => {
      const bucketFake = jasmine.createSpyObj('bucket', ['upload', 'getPublicUrl']);
      bucketFake.upload.and.returnValue(Promise.resolve({ error: new Error('falhou') }));
      clienteFake.storage.from.and.returnValue(bucketFake);
      const arquivo = new File(['x'], 'video.mp4');

      service.enviarVideo('camiseta-batman', arquivo).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('excluirImagem', () => {
    it('não faz nada quando a URL não é do bucket de produtos', (done) => {
      service.excluirImagem('https://outro-lugar.com/foto.webp').subscribe(() => {
        expect(clienteFake.storage.from).not.toHaveBeenCalled();
        done();
      });
    });

    it('extrai o caminho da URL e remove do Storage', (done) => {
      const bucketFake = jasmine.createSpyObj('bucket', ['remove']);
      bucketFake.remove.and.returnValue(Promise.resolve({ error: null }));
      clienteFake.storage.from.and.returnValue(bucketFake);

      service
        .excluirImagem('https://xyz.supabase.co/storage/v1/object/public/produtos/camiseta/foto.webp')
        .subscribe(() => {
          expect(bucketFake.remove).toHaveBeenCalledWith(['camiseta/foto.webp']);
          done();
        });
    });

    it('propaga o erro quando a remoção falha', (done) => {
      const bucketFake = jasmine.createSpyObj('bucket', ['remove']);
      bucketFake.remove.and.returnValue(Promise.resolve({ error: new Error('falhou') }));
      clienteFake.storage.from.and.returnValue(bucketFake);

      service
        .excluirImagem('https://xyz.supabase.co/storage/v1/object/public/produtos/camiseta/foto.webp')
        .subscribe({
          error: (erro) => {
            expect(erro.message).toBe('falhou');
            done();
          },
        });
    });
  });
});
