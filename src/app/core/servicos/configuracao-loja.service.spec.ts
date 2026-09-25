import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ConfiguracaoLojaService } from './configuracao-loja.service';
import { SupabaseRestService } from './supabase-rest.service';
import { SupabaseClienteService } from './supabase.client';
import { ConfiguracaoLoja } from '../modelos/configuracao-loja.model';

function linhaConfiguracao(sobrescritas: Record<string, unknown> = {}) {
  return {
    nome_loja: 'Vista Nostálgica',
    descricao_padrao: 'A loja temática nostálgica',
    email_contato: 'contato@vistanostalgica.com',
    whatsapp_numero: '5511999999999',
    whatsapp_mensagem: 'Olá! Preciso de ajuda.',
    instagram_url: null,
    tiktok_url: null,
    cidades_frete_gratis: null,
    mensagens_barra_anuncio: null,
    ...sobrescritas,
  };
}

function dadosConfiguracao(sobrescritas: Partial<ConfiguracaoLoja> = {}): ConfiguracaoLoja {
  return {
    nomeLoja: 'Vista Nostálgica',
    descricaoPadrao: 'A loja temática nostálgica',
    emailContato: 'contato@vistanostalgica.com',
    whatsappNumero: '5511999999999',
    whatsappMensagem: 'Olá! Preciso de ajuda.',
    cidadesFreteGratis: [],
    mensagensBarraAnuncio: [],
    ...sobrescritas,
  };
}

describe('ConfiguracaoLojaService', () => {
  let service: ConfiguracaoLojaService;
  let restSpy: jasmine.SpyObj<SupabaseRestService>;
  let clienteFake: { from: jasmine.Spy };
  let tabelaFake: jasmine.SpyObj<{ update: jasmine.Spy; eq: jasmine.Spy; select: jasmine.Spy; single: jasmine.Spy }>;

  beforeEach(() => {
    restSpy = jasmine.createSpyObj('SupabaseRestService', ['select']);

    tabelaFake = jasmine.createSpyObj('tabela', ['update', 'eq', 'select', 'single']);
    tabelaFake.update.and.returnValue(tabelaFake);
    tabelaFake.eq.and.returnValue(tabelaFake);
    tabelaFake.select.and.returnValue(tabelaFake);

    clienteFake = { from: jasmine.createSpy('from').and.returnValue(tabelaFake) };
    const supabaseClienteSpy = jasmine.createSpyObj('SupabaseClienteService', ['obterCliente']);
    supabaseClienteSpy.obterCliente.and.returnValue(clienteFake as never);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseRestService, useValue: restSpy },
        { provide: SupabaseClienteService, useValue: supabaseClienteSpy },
      ],
    });
    service = TestBed.inject(ConfiguracaoLojaService);
  });

  describe('linkWhatsapp', () => {
    it('devolve string vazia antes de carregar a configuração', () => {
      expect(service.linkWhatsapp()).toBe('');
    });

    it('monta a URL de wa.me com número e mensagem codificados', (done) => {
      restSpy.select.and.returnValue(of([linhaConfiguracao()]));

      service.carregarInicial().subscribe(() => {
        expect(service.linkWhatsapp()).toBe(
          'https://wa.me/5511999999999?text=' + encodeURIComponent('Olá! Preciso de ajuda.')
        );
        done();
      });
    });
  });

  describe('carregarInicial', () => {
    it('busca a linha única e mapeia pra ConfiguracaoLoja, atualizando o signal', (done) => {
      restSpy.select.and.returnValue(of([linhaConfiguracao()]));

      service.carregarInicial().subscribe((configuracao) => {
        expect(configuracao.nomeLoja).toBe('Vista Nostálgica');
        expect(service.configuracao()).toEqual(configuracao);
        done();
      });
    });

    it('propaga o erro quando a busca falha', (done) => {
      restSpy.select.and.returnValue(throwError(() => new Error('falhou')));

      service.carregarInicial().subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });

  describe('atualizar', () => {
    it('atualiza a linha única (id=loja) e sincroniza o signal', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: linhaConfiguracao({ nome_loja: 'Nova Loja' }), error: null })
      );

      service.atualizar(dadosConfiguracao({ nomeLoja: 'Nova Loja' })).subscribe((configuracao) => {
        expect(clienteFake.from).toHaveBeenCalledWith('configuracao_loja');
        expect(tabelaFake.eq).toHaveBeenCalledWith('id', 'loja');
        expect(configuracao.nomeLoja).toBe('Nova Loja');
        expect(service.configuracao()?.nomeLoja).toBe('Nova Loja');
        done();
      });
    });

    it('propaga o erro quando a atualização falha', (done) => {
      tabelaFake.single.and.returnValue(
        Promise.resolve({ data: null, error: new Error('falhou') })
      );

      service.atualizar(dadosConfiguracao()).subscribe({
        error: (erro) => {
          expect(erro.message).toBe('falhou');
          done();
        },
      });
    });
  });
});
