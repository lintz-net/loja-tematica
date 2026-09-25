import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminConfigComponent } from './admin-config.component';
import { ConfiguracaoLojaService } from '../../../../core/servicos/configuracao-loja.service';
import { ConfiguracaoLoja } from '../../../../core/modelos/configuracao-loja.model';

function criarConfiguracao(sobrescritas: Partial<ConfiguracaoLoja> = {}): ConfiguracaoLoja {
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

describe('AdminConfigComponent', () => {
  let configuracaoLojaServiceSpy: jasmine.SpyObj<ConfiguracaoLojaService>;

  function configurar(): ComponentFixture<AdminConfigComponent> {
    TestBed.configureTestingModule({
      imports: [AdminConfigComponent],
      providers: [{ provide: ConfiguracaoLojaService, useValue: configuracaoLojaServiceSpy }],
    });
    const fixture = TestBed.createComponent(AdminConfigComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    configuracaoLojaServiceSpy = jasmine.createSpyObj('ConfiguracaoLojaService', [
      'configuracao',
      'atualizar',
    ]);
    configuracaoLojaServiceSpy.configuracao.and.returnValue(criarConfiguracao());
  });

  it('popula os campos com a configuração já carregada', () => {
    const fixture = configurar();
    const comp = fixture.componentInstance;

    expect(comp.nomeLoja()).toBe('Vista Nostálgica');
    expect(comp.emailContato()).toBe('contato@vistanostalgica.com');
    expect(comp.instagramUrl()).toBe('');
  });

  describe('mensagens da barra de anúncio', () => {
    it('adiciona e remove mensagens', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaMensagemBarraAnuncio.set('Frete grátis acima de R$150');

      comp.adicionarMensagemBarraAnuncio();

      expect(comp.mensagensBarraAnuncio()).toEqual(['Frete grátis acima de R$150']);
      expect(comp.novaMensagemBarraAnuncio()).toBe('');

      comp.removerMensagemBarraAnuncio(0);

      expect(comp.mensagensBarraAnuncio()).toEqual([]);
    });

    it('não adiciona mensagem vazia', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaMensagemBarraAnuncio.set('   ');

      comp.adicionarMensagemBarraAnuncio();

      expect(comp.mensagensBarraAnuncio()).toEqual([]);
    });
  });

  describe('cidades com frete grátis', () => {
    it('adiciona quando cidade e UF (2 letras) estão preenchidos', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaCidade.set('Curitiba');
      comp.novaUf.set('pr');

      comp.adicionarCidadeFreteGratis();

      expect(comp.cidadesFreteGratis()).toEqual([{ cidade: 'Curitiba', uf: 'PR' }]);
      expect(comp.novaCidade()).toBe('');
      expect(comp.novaUf()).toBe('');
    });

    it('não adiciona quando a UF não tem 2 letras', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaCidade.set('Curitiba');
      comp.novaUf.set('paraná');

      comp.adicionarCidadeFreteGratis();

      expect(comp.cidadesFreteGratis()).toEqual([]);
    });

    it('remove a cidade pelo índice', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.novaCidade.set('Curitiba');
      comp.novaUf.set('PR');
      comp.adicionarCidadeFreteGratis();

      comp.removerCidadeFreteGratis(0);

      expect(comp.cidadesFreteGratis()).toEqual([]);
    });
  });

  describe('podeSalvar', () => {
    it('exige nome, descrição, e-mail válido e whatsapp com ao menos 10 dígitos', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;

      expect(comp.podeSalvar()).toBeTrue();

      comp.emailContato.set('email-invalido');
      expect(comp.podeSalvar()).toBeFalse();

      comp.emailContato.set('contato@loja.com');
      comp.whatsappNumero.set('123');
      expect(comp.podeSalvar()).toBeFalse();
    });
  });

  describe('salvar', () => {
    it('salva os dados normalizados e marca salvo=true', () => {
      configuracaoLojaServiceSpy.atualizar.and.returnValue(of(criarConfiguracao()));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.whatsappNumero.set('(11) 99999-9999');

      comp.salvar();

      expect(configuracaoLojaServiceSpy.atualizar).toHaveBeenCalledWith(
        jasmine.objectContaining({ whatsappNumero: '11999999999' })
      );
      expect(comp.salvando()).toBeFalse();
      expect(comp.salvo()).toBeTrue();
    });

    it('não chama o serviço quando o formulário é inválido', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.emailContato.set('invalido');

      comp.salvar();

      expect(configuracaoLojaServiceSpy.atualizar).not.toHaveBeenCalled();
    });

    it('mostra erro quando salvar falha', () => {
      configuracaoLojaServiceSpy.atualizar.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.salvar();

      expect(fixture.componentInstance.erro()).toContain('Não foi possível salvar');
      expect(fixture.componentInstance.salvando()).toBeFalse();
    });
  });
});
