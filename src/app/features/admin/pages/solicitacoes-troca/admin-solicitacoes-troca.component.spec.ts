import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminSolicitacoesTrocaComponent } from './admin-solicitacoes-troca.component';
import { AdminSolicitacaoTrocaService } from '../../../../core/servicos/admin-solicitacao-troca.service';
import { SolicitacaoTroca } from '../../../../core/modelos/solicitacao-troca.model';

function solicitacao(sobrescritas: Partial<SolicitacaoTroca> = {}): SolicitacaoTroca {
  return {
    id: 'sol-1',
    pedidoCodigo: 'VT-ABC123',
    emailCliente: 'izac@example.com',
    tipo: 'troca',
    itens: [{ produtoNome: 'Camiseta X', produtoSlug: 'camiseta-x', tamanho: 'M', cor: 'Preto', quantidade: 1 }],
    motivo: 'Tamanho errado',
    status: 'pendente',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('AdminSolicitacoesTrocaComponent', () => {
  let servicoSpy: jasmine.SpyObj<AdminSolicitacaoTrocaService>;

  function configurar(): ComponentFixture<AdminSolicitacoesTrocaComponent> {
    TestBed.configureTestingModule({
      imports: [AdminSolicitacoesTrocaComponent],
      providers: [provideRouter([]), { provide: AdminSolicitacaoTrocaService, useValue: servicoSpy }],
    });
    const fixture = TestBed.createComponent(AdminSolicitacoesTrocaComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    servicoSpy = jasmine.createSpyObj('AdminSolicitacaoTrocaService', ['listarTodas', 'atualizarStatus']);
  });

  it('carrega as solicitações ao construir', () => {
    servicoSpy.listarTodas.and.returnValue(of([solicitacao()]));

    const fixture = configurar();

    expect(fixture.componentInstance.solicitacoes()).toEqual([solicitacao()]);
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });

  it('mostra erro quando a listagem falha', () => {
    servicoSpy.listarTodas.and.returnValue(throwError(() => new Error('falhou')));

    const fixture = configurar();

    expect(fixture.componentInstance.erro()).toContain('Não foi possível carregar');
  });

  it('atualizarStatus manda a resposta digitada e atualiza a linha na lista', () => {
    servicoSpy.listarTodas.and.returnValue(of([solicitacao()]));
    servicoSpy.atualizarStatus.and.returnValue(
      of(solicitacao({ status: 'aprovada', respostaAdmin: 'Pode devolver' }))
    );
    const fixture = configurar();
    const comp = fixture.componentInstance;
    comp.atualizarRespostaDigitada('sol-1', 'Pode devolver');

    comp.atualizarStatus(solicitacao(), 'aprovada');

    expect(servicoSpy.atualizarStatus).toHaveBeenCalledWith('sol-1', 'aprovada', 'Pode devolver');
    expect(comp.solicitacoes()[0].status).toBe('aprovada');
    expect(comp.idSalvando()).toBeNull();
  });

  it('mostra erro quando a atualização falha', () => {
    servicoSpy.listarTodas.and.returnValue(of([solicitacao()]));
    servicoSpy.atualizarStatus.and.returnValue(throwError(() => new Error('falhou')));
    const fixture = configurar();
    const comp = fixture.componentInstance;

    comp.atualizarStatus(solicitacao(), 'recusada');

    expect(comp.erro()).toContain('Não foi possível atualizar');
  });
});
