import { Component, HostListener, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BuscaService } from '../../../core/servicos/busca.service';
import { CatalogoRepositorio } from '../../../core/servicos/catalogo.repositorio';

const LIMITE_RESULTADOS_BUSCA = 6;

@Component({
  selector: 'app-busca-global',
  standalone: true,
  templateUrl: './busca-global.component.html',
  styleUrl: './busca-global.component.scss',
})
export class BuscaGlobalComponent {
  private readonly buscaService = inject(BuscaService);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly router = inject(Router);

  readonly aberta = this.buscaService.aberta;
  readonly termo = this.buscaService.termo;

  private readonly produtos = toSignal(this.catalogoRepositorio.obterProdutos(), {
    initialValue: [],
  });

  readonly resultados = computed(() => {
    const termo = this.termo().trim().toLowerCase();
    if (!termo) return [];
    return this.produtos()
      .filter((produto) => produto.nome.toLowerCase().includes(termo))
      .slice(0, LIMITE_RESULTADOS_BUSCA);
  });

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    if (this.aberta()) {
      this.fechar();
    }
  }

  fechar(): void {
    this.buscaService.fechar();
  }

  atualizarTermo(valor: string): void {
    this.buscaService.atualizarTermo(valor);
  }

  irParaProduto(slug: string): void {
    this.fechar();
    this.router.navigate(['/produto', slug]);
  }
}
