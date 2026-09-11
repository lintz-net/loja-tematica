import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Cupom, TipoDescontoCupom } from '../../../../core/modelos/cupom.model';
import { AdminCupomService } from '../../../../core/servicos/admin-cupom.service';

@Component({
  selector: 'app-admin-cupons',
  standalone: true,
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './admin-cupons.component.html',
  styleUrl: './admin-cupons.component.scss',
})
export class AdminCuponsComponent {
  private readonly adminCupomService = inject(AdminCupomService);

  readonly carregando = signal(true);
  readonly cupons = signal<Cupom[]>([]);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly codigoAlternando = signal<string | null>(null);
  readonly codigoExcluindo = signal<string | null>(null);

  // Formulário de novo cupom
  readonly novoCodigo = signal('');
  readonly novoTipoDesconto = signal<TipoDescontoCupom>('percentual');
  readonly novoValorDesconto = signal<number | null>(null);
  readonly novaDataExpiracao = signal('');

  readonly podeCriar = (): boolean =>
    this.novoCodigo().trim().length > 0 &&
    !!this.novoValorDesconto() &&
    this.novoValorDesconto()! > 0;

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.adminCupomService.listarTodos().subscribe({
      next: (cupons) => {
        this.cupons.set(cupons);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os cupons.');
        this.carregando.set(false);
      },
    });
  }

  atualizarNovoCodigo(valor: string): void {
    this.novoCodigo.set(valor.toUpperCase().replace(/\s+/g, ''));
  }

  atualizarNovoTipoDesconto(valor: string): void {
    this.novoTipoDesconto.set(valor as TipoDescontoCupom);
  }

  atualizarNovoValorDesconto(valor: string): void {
    this.novoValorDesconto.set(valor ? Number(valor) : null);
  }

  atualizarNovaDataExpiracao(valor: string): void {
    this.novaDataExpiracao.set(valor);
  }

  criarCupom(): void {
    if (!this.podeCriar()) return;

    this.salvando.set(true);
    this.erro.set(null);
    this.adminCupomService
      .criar({
        codigo: this.novoCodigo().trim(),
        tipoDesconto: this.novoTipoDesconto(),
        valorDesconto: this.novoValorDesconto()!,
        expiraEm: this.novaDataExpiracao()
          ? new Date(this.novaDataExpiracao()).toISOString()
          : undefined,
      })
      .subscribe({
        next: (cupom) => {
          this.cupons.update((atual) => [cupom, ...atual]);
          this.salvando.set(false);
          this.novoCodigo.set('');
          this.novoValorDesconto.set(null);
          this.novaDataExpiracao.set('');
        },
        error: (erro) => {
          this.salvando.set(false);
          this.erro.set(
            erro?.message?.includes('duplicate')
              ? 'Já existe um cupom com esse código.'
              : 'Não foi possível criar o cupom.'
          );
        },
      });
  }

  alternarAtivo(cupom: Cupom): void {
    this.codigoAlternando.set(cupom.codigo);
    this.adminCupomService.alternarAtivo(cupom.codigo, !cupom.ativo).subscribe({
      next: (atualizado) => {
        this.cupons.update((atual) =>
          atual.map((c) => (c.codigo === atualizado.codigo ? atualizado : c))
        );
        this.codigoAlternando.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível atualizar o cupom ${cupom.codigo}.`);
        this.codigoAlternando.set(null);
      },
    });
  }

  excluir(cupom: Cupom): void {
    if (!confirm(`Excluir o cupom "${cupom.codigo}"? Essa ação não pode ser desfeita.`)) return;

    this.codigoExcluindo.set(cupom.codigo);
    this.adminCupomService.excluir(cupom.codigo).subscribe({
      next: () => {
        this.cupons.update((atual) => atual.filter((c) => c.codigo !== cupom.codigo));
        this.codigoExcluindo.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível excluir o cupom ${cupom.codigo}.`);
        this.codigoExcluindo.set(null);
      },
    });
  }

  expirado(cupom: Cupom): boolean {
    return !!cupom.expiraEm && new Date(cupom.expiraEm).getTime() < Date.now();
  }
}
