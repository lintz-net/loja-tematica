import { TestBed } from '@angular/core/testing';
import { AdminBannerService } from './admin-banner.service';
import { SupabaseClienteService } from './supabase.client';
import { Banner } from '../modelos/banner.model';

function linhaBanner(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'banner-1',
    imagem_url: 'https://cdn/banner.webp',
    alt: 'Promoção',
    link: null,
    destino: 'home',
    ordem: 0,
    ...sobrescritas,
  };
}

function dadosBanner(sobrescritas: Partial<Omit<Banner, 'id'>> = {}): Omit<Banner, 'id'> {
  return {
    imagemUrl: 'https://cdn/banner.webp',
    alt: 'Promoção',
    destino: 'home',
    ordem: 0,
    ...sobrescritas,
  };
}

describe('AdminBannerService', () => {
  let service: AdminBannerService;
  let clienteFake: { from: jasmine.Spy; storage: { from: jasmine.Spy } };
  let tabelaFake: jasmine.SpyObj<{
    select: jasmine.Spy;
    insert: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
    eq: jasmine.Spy;
    order: jasmine.Spy;
    single: jasmine.Spy;
  }>;

  beforeEach(() => {
    tabelaFake = jasmine.createSpyObj('tabela', [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'order',
      'single',
    ]);
    tabelaFake.select.and.returnValue(tabelaFake);
    tabelaFake.insert.and.returnValue(tabelaFake);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.delete.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);
    tabelaFake.order.and.returnValue(tabelaFake);

    clienteFake = {
      from: jasmine.createSpy('from').and.returnValue(tabelaFake),
      storage: { from: jasmine.createSpy('storageFrom') },
    };

    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseClienteService, useValue: supabaseClienteSpy }],
    });
    service = TestBed.inject(AdminBannerService);
  });

  describe('listar', () => {
    it('mapeia as linhas ordenadas por ordem', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: [linhaBanner()], error: null }));

      service.listar().subscribe((banners) => {
        expect(clienteFake.from).toHaveBeenCalledWith('banners');
        expect(banners).toEqual([
          jasmine.objectContaining({ id: 'banner-1', imagemUrl: 'https://cdn/banner.webp' }),
        ]);
        done();
      });
    });

    it('propaga o erro quando a listagem falha', (done) => {
      tabelaFake.order.and.returnValue(Promise.resolve({ data: null, error: new Error('falhou') }));

      service.listar().subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('criar', () => {
    it('insere a linha em snake_case e devolve o banner mapeado', (done) => {
      tabelaFake.single.and.returnValue(Promise.resolve({ data: linhaBanner(), error: null }));

      service.criar(dadosBanner()).subscribe((banner) => {
        expect(tabelaFake.insert).toHaveBeenCalledWith(
          jasmine.objectContaining({ imagem_url: 'https://cdn/banner.webp', link: null })
        );
        expect(banner.alt).toBe('Promoção');
        done();
      });
    });

    it('propaga o erro quando o insert falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.criar(dadosBanner()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('atualizar', () => {
    it('atualiza pelo id', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaBanner({ alt: 'Nova' }), error: null })
      );

      service.atualizar('banner-1', dadosBanner({ alt: 'Nova' })).subscribe((banner) => {
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'banner-1');
        expect(banner.alt).toBe('Nova');
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.atualizar('banner-1', dadosBanner()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('remover', () => {
    it('remove pelo id', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: null }));

      service.remover('banner-1').subscribe(() => {
        expect(tabelaFake.delete).toHaveBeenCalled();
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'banner-1');
        done();
      });
    });

    it('propaga o erro quando a remoção falha', (done) => {
      tabelaFake.eq.and.returnValue(Promise.resolve({ error: new Error('falhou') }));

      service.remover('banner-1').subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('enviarImagem', () => {
    it('sobe a imagem e devolve a URL pública', (done) => {
      const bucketFake = jasmine.createSpyObj('bucket', ['upload', 'getPublicUrl']);
      bucketFake.upload.and.returnValue(Promise.resolve({ error: null }));
      bucketFake.getPublicUrl.and.returnValue({ data: { publicUrl: 'https://cdn/novo.webp' } });
      clienteFake.storage.from.and.returnValue(bucketFake);

      service.enviarImagem(new File(['x'], 'banner.webp')).subscribe((url) => {
        expect(clienteFake.storage.from).toHaveBeenCalledWith('banners');
        expect(url).toBe('https://cdn/novo.webp');
        done();
      });
    });

    it('propaga o erro quando o upload falha', (done) => {
      const bucketFake = jasmine.createSpyObj('bucket', ['upload', 'getPublicUrl']);
      bucketFake.upload.and.returnValue(Promise.resolve({ error: new Error('falhou') }));
      clienteFake.storage.from.and.returnValue(bucketFake);

      service.enviarImagem(new File(['x'], 'banner.webp')).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
