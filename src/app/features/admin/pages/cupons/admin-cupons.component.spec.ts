import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminCuponsComponent } from './admin-cupons.component';
import { AdminCupomService } from '../../../../core/servicos/admin-cupom.service';
import { Cupom } from '../../../../core/modelos/cupom.model';

function criarCupom(sobrescritas: Partial<Cupom> = {}): Cupom {
  return {
    codigo: 'PROMO10',
    tipoDesconto: 'percentual',
    valorDesconto: 10,
    ativo: true,
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('AdminCuponsComponent', () => {
  let adminCupomServiceSpy: jasmine.SpyObj<AdminCupomService>;

  function configurar(): ComponentFixture<AdminCuponsComponent> {
    TestBed.configureTestingModule({
      imports: [AdminCuponsComponent],
      providers: [{ provide: AdminCupomService, useValue: adminCupomServiceSpy }],
    });
    const fixture = TestBed.createComponent(AdminCuponsComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    adminCupomServiceSpy = jasmine.createSpyObj('AdminCupomService', [
      'listarTodos',
      'criar',
      'alternarAtivo',
      'excluir',
    ]);
    adminCupomServiceSpy.listarTodos.and.returnValue(of([criarCupom()]));
  });

  it('carrega os cupons', () => {
    const fixture = configurar();

    expect(fixture.componentInstance.carregando()).toBeFalse();
    expect(fixture.componentInstance.cupons()).toEqual([criarCupom()]);
  });

  it('mostra erro quando a listagem falha', () => {
    adminCupomServiceSpy.listarTodos.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar os cupons');
  });

  describe('atualizarNovoCodigo', () => {
    it('normaliza pra maiúsculas e remove espaços', () => {
      const fixture = configurar();
      fixture.componentInstance.atualizarNovoCodigo('  promo ver ao  ');

      expect(fixture.componentInstance.novoCodigo()).toBe('PROMOVERAO');
    });
  });

  describe('podeCriar', () => {
    it('exige código e valor de desconto positivo', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;

      expect(comp.podeCriar()).toBeFalse();

      comp.atualizarNovoCodigo('PROMO20');
      expect(comp.podeCriar()).toBeFalse();

      comp.atualizarNovoValorDesconto('0');
      expect(comp.podeCriar()).toBeFalse();

      comp.atualizarNovoValorDesconto('20');
      expect(comp.podeCriar()).toBeTrue();
    });
  });

  describe('criarCupom', () => {
    it('cria o cupom, insere no topo da lista e limpa o formulário', () => {
      const novo = criarCupom({ codigo: 'PROMO20', valorDesconto: 20 });
      adminCupomServiceSpy.criar.and.returnValue(of(novo));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovoCodigo('PROMO20');
      comp.atualizarNovoValorDesconto('20');

      comp.criarCupom();

      expect(adminCupomServiceSpy.criar).toHaveBeenCalledWith(
        jasmine.objectContaining({ codigo: 'PROMO20', valorDesconto: 20 })
      );
      expect(comp.cupons()[0]).toEqual(novo);
      expect(comp.novoCodigo()).toBe('');
      expect(comp.salvando()).toBeFalse();
    });

    it('não chama o serviço quando o formulário está incompleto', () => {
      const fixture = configurar();
      fixture.componentInstance.criarCupom();

      expect(adminCupomServiceSpy.criar).not.toHaveBeenCalled();
    });

    it('mostra mensagem específica quando o código já existe (erro duplicate)', () => {
      adminCupomServiceSpy.criar.and.returnValue(
        throwError(() => ({ message: 'duplicate key value violates constraint' }))
      );
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovoCodigo('PROMO20');
      comp.atualizarNovoValorDesconto('20');

      comp.criarCupom();

      expect(comp.erro()).toContain('Já existe um cupom com esse código');
    });

    it('mostra mensagem genérica pra outras falhas', () => {
      adminCupomServiceSpy.criar.and.returnValue(throwError(() => new Error('erro qualquer')));
      const fixture = configurar();
      const comp = fixture.componentInstance;
      comp.atualizarNovoCodigo('PROMO20');
      comp.atualizarNovoValorDesconto('20');

      comp.criarCupom();

      expect(comp.erro()).toBe('Não foi possível criar o cupom.');
    });
  });

  describe('alternarAtivo', () => {
    it('atualiza o cupom na lista com o novo estado', () => {
      const cupomAtualizado = criarCupom({ ativo: false });
      adminCupomServiceSpy.alternarAtivo.and.returnValue(of(cupomAtualizado));
      const fixture = configurar();

      fixture.componentInstance.alternarAtivo(criarCupom());

      expect(adminCupomServiceSpy.alternarAtivo).toHaveBeenCalledWith('PROMO10', false);
      expect(fixture.componentInstance.cupons()[0].ativo).toBeFalse();
      expect(fixture.componentInstance.codigoAlternando()).toBeNull();
    });

    it('mostra erro quando a alternância falha', () => {
      adminCupomServiceSpy.alternarAtivo.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.alternarAtivo(criarCupom());

      expect(fixture.componentInstance.erro()).toContain('Não foi possível atualizar o cupom');
    });
  });

  describe('excluir', () => {
    it('não exclui quando o admin cancela a confirmação', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCupom());

      expect(adminCupomServiceSpy.excluir).not.toHaveBeenCalled();
    });

    it('remove o cupom da lista quando confirmado e a exclusão dá certo', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminCupomServiceSpy.excluir.and.returnValue(of(undefined));
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCupom());

      expect(fixture.componentInstance.cupons()).toEqual([]);
      expect(fixture.componentInstance.codigoExcluindo()).toBeNull();
    });

    it('mostra erro quando a exclusão falha', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminCupomServiceSpy.excluir.and.returnValue(throwError(() => new Error('falhou')));
      const fixture = configurar();

      fixture.componentInstance.excluir(criarCupom());

      expect(fixture.componentInstance.erro()).toContain('Não foi possível excluir o cupom');
    });
  });

  describe('expirado', () => {
    it('é falso quando não há data de expiração', () => {
      const fixture = configurar();
      expect(fixture.componentInstance.expirado(criarCupom({ expiraEm: undefined }))).toBeFalse();
    });

    it('é verdadeiro quando a data de expiração já passou', () => {
      const fixture = configurar();
      expect(
        fixture.componentInstance.expirado(criarCupom({ expiraEm: '2020-01-01T00:00:00.000Z' }))
      ).toBeTrue();
    });

    it('é falso quando a data de expiração ainda não chegou', () => {
      const fixture = configurar();
      expect(
        fixture.componentInstance.expirado(criarCupom({ expiraEm: '2999-01-01T00:00:00.000Z' }))
      ).toBeFalse();
    });
  });

  describe('atualizarNovoTipoDesconto / atualizarNovaDataExpiracao', () => {
    it('atualizam os signals do formulário', () => {
      const fixture = configurar();
      const comp = fixture.componentInstance;

      comp.atualizarNovoTipoDesconto('valor_fixo');
      expect(comp.novoTipoDesconto()).toBe('valor_fixo');

      comp.atualizarNovaDataExpiracao('2026-12-31');
      expect(comp.novaDataExpiracao()).toBe('2026-12-31');
    });
  });
});
