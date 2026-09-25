import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminBannersComponent } from './admin-banners.component';
import { AdminBannerService } from '../../../../core/servicos/admin-banner.service';
import { Banner } from '../../../../core/modelos/banner.model';

function criarBanner(sobrescritas: Partial<Banner> = {}): Banner {
  return {
    id: 'banner-1',
    imagemUrl: 'https://exemplo.com/banner.webp',
    alt: 'Promoção de lançamento',
    destino: 'home',
    ordem: 0,
    ...sobrescritas,
  };
}

function criarEventoArquivo(arquivo: File | undefined): Event {
  const input = document.createElement('input');
  input.type = 'file';
  if (arquivo) {
    const dt = new DataTransfer();
    dt.items.add(arquivo);
    input.files = dt.files;
  }
  return { target: input } as unknown as Event;
}

describe('AdminBannersComponent', () => {
  let adminBannerServiceSpy: jasmine.SpyObj<AdminBannerService>;

  function configurar(): ComponentFixture<AdminBannersComponent> {
    TestBed.configureTestingModule({
      imports: [AdminBannersComponent],
      providers: [{ provide: AdminBannerService, useValue: adminBannerServiceSpy }],
    });
    const fixture = TestBed.createComponent(AdminBannersComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    adminBannerServiceSpy = jasmine.createSpyObj('AdminBannerService', [
      'listar',
      'enviarImagem',
      'criar',
      'remover',
    ]);
    adminBannerServiceSpy.listar.and.returnValue(of([criarBanner()]));
  });

  it('carrega os banners', () => {
    const fixture = configurar();

    expect(fixture.componentInstance.carregando()).toBeFalse();
    expect(fixture.componentInstance.banners()).toEqual([criarBanner()]);
  });

  it('mostra erro quando a listagem falha', () => {
    adminBannerServiceSpy.listar.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar os banners');
  });

  describe('aoSelecionarImagem', () => {
    it('não faz nada quando nenhum arquivo é selecionado', () => {
      const fixture = configurar();

      fixture.componentInstance.aoSelecionarImagem(criarEventoArquivo(undefined));

      expect(adminBannerServiceSpy.enviarImagem).not.toHaveBeenCalled();
    });

    it('envia a imagem e preenche novaImagemUrl com a url devolvida', () => {
      adminBannerServiceSpy.enviarImagem.and.returnValue(of('https://cdn.exemplo.com/img.webp'));
      const fixture = configurar();
      const arquivo = new File(['conteudo'], 'foto.webp', { type: 'image/webp' });

      fixture.componentInstance.aoSelecionarImagem(criarEventoArquivo(arquivo));

      expect(fixture.componentInstance.novaImagemUrl()).toBe('https://cdn.exemplo.com/img.webp');
      expect(fixture.componentInstance.enviandoImagem()).toBeFalse();
    });

    it('mostra erro quando o envio da imagem falha', () => {
      adminBannerServiceSpy.enviarImagem.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();
      const arquivo = new File(['conteudo'], 'foto.webp', { type: 'image/webp' });

      fixture.componentInstance.aoSelecionarImagem(criarEventoArquivo(arquivo));

      expect(fixture.componentInstance.erro()).toContain('Falha ao enviar a imagem');
      expect(fixture.componentInstance.enviandoImagem()).toBeFalse();
    });
  });

  describe('podeCriar', () => {
    it('exige url de imagem e alt preenchidos, e nenhum upload em andamento', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;

      expect(comp.podeCriar()).toBeFalse();

      comp.novaImagemUrl.set('https://exemplo.com/img.webp');
      expect(comp.podeCriar()).toBeFalse();

      comp.novoAlt.set('Descrição');
      expect(comp.podeCriar()).toBeTrue();

      comp.enviandoImagem.set(true);
      expect(comp.podeCriar()).toBeFalse();
    });
  });

  describe('criarBanner', () => {
    it('cria o banner, adiciona à lista e limpa o formulário', () => {
      const novo = criarBanner({ id: 'banner-2', alt: 'Novo banner' });
      adminBannerServiceSpy.criar.and.returnValue(of(novo));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaImagemUrl.set('https://exemplo.com/img.webp');
      comp.novoAlt.set('Novo banner');

      comp.criarBanner();

      expect(adminBannerServiceSpy.criar).toHaveBeenCalledWith(
        jasmine.objectContaining({ imagemUrl: 'https://exemplo.com/img.webp', alt: 'Novo banner' })
      );
      expect(comp.banners()).toContain(novo);
      expect(comp.novaImagemUrl()).toBe('');
      expect(comp.novoAlt()).toBe('');
      expect(comp.salvando()).toBeFalse();
    });

    it('não chama o serviço quando o formulário está incompleto', () => {
      const fixture = configurar();
      fixture.componentInstance.criarBanner();

      expect(adminBannerServiceSpy.criar).not.toHaveBeenCalled();
    });

    it('mostra erro quando a criação falha', () => {
      adminBannerServiceSpy.criar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaImagemUrl.set('https://exemplo.com/img.webp');
      comp.novoAlt.set('Novo banner');

      comp.criarBanner();

      expect(comp.erro()).toContain('Não foi possível criar o banner');
      expect(comp.salvando()).toBeFalse();
    });
  });

  describe('remover', () => {
    it('não remove quando o admin cancela a confirmação', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = configurar();

      fixture.componentInstance.remover(criarBanner());

      expect(adminBannerServiceSpy.remover).not.toHaveBeenCalled();
    });

    it('remove o banner da lista quando confirmado e a remoção dá certo', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminBannerServiceSpy.remover.and.returnValue(of(undefined));
      const fixture = configurar();

      fixture.componentInstance.remover(criarBanner());

      expect(fixture.componentInstance.banners()).toEqual([]);
      expect(fixture.componentInstance.idExcluindo()).toBeNull();
    });

    it('mostra erro quando a remoção falha', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminBannerServiceSpy.remover.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.remover(criarBanner());

      expect(fixture.componentInstance.erro()).toContain('Não foi possível excluir o banner');
    });
  });
});
