import { Component, computed, inject, signal } from '@angular/core';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminCategoriaService } from '../../../../core/servicos/admin-categoria.service';
import { Categoria } from '../../../../core/modelos/categoria.model';

function gerarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Component({
  selector: 'app-admin-categorias',
  standalone: true,
  templateUrl: './admin-categorias.component.html',
  styleUrl: './admin-categorias.component.scss',
})
export class AdminCategoriasComponent {
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly adminCategoriaService = inject(AdminCategoriaService);

  readonly carregando = signal(true);
  readonly categorias = signal<Categoria[]>([]);
  /** slug -> quantidade de produtos usando essa categoria — só pra decidir se pode excluir
   * sem deixar produto apontando pra uma categoria que já não existe mais. */
  readonly produtosPorCategoria = signal<Record<string, number>>({});
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly idExcluindo = signal<string | null>(null);

  // Formulário de categoria nova
  readonly novoNome = signal('');
  readonly novoSlug = signal('');
  readonly slugEditadoManualmente = signal(false);
  readonly novaCorTema = signal('#7b2ff7');
  readonly novoIcone = signal('');
  readonly novaDescricao = signal('');

  readonly podeCriar = computed(
    () =>
      this.novoNome().trim().length > 0 &&
      this.novoSlug().trim().length > 0 &&
      this.novoIcone().trim().length > 0 &&
      !this.salvando()
  );

  // Edição inline — só uma linha por vez
  readonly idEmEdicao = signal<string | null>(null);
  readonly edNome = signal('');
  readonly edSlug = signal('');
  readonly edCorTema = signal('');
  readonly edIcone = signal('');
  readonly edDescricao = signal('');

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.catalogoRepositorio.obterCategorias().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as categorias.');
        this.carregando.set(false);
      },
    });

    // Só pra saber quais categorias têm produto vinculado (bloquear exclusão) — não precisa
    // recarregar isso toda hora, contagem aproximada no momento em que a tela abre já serve.
    this.catalogoRepositorio.obterProdutos().subscribe((produtos) => {
      const contagem: Record<string, number> = {};
      for (const produto of produtos) {
        for (const slug of produto.categorias) {
          contagem[slug] = (contagem[slug] ?? 0) + 1;
        }
      }
      this.produtosPorCategoria.set(contagem);
    });
  }

  atualizarNovoNome(valor: string): void {
    this.novoNome.set(valor);
    if (!this.slugEditadoManualmente()) {
      this.novoSlug.set(gerarSlug(valor));
    }
  }

  atualizarNovoSlug(valor: string): void {
    this.slugEditadoManualmente.set(true);
    this.novoSlug.set(gerarSlug(valor));
  }

  criar(): void {
    if (!this.podeCriar()) return;

    const slug = this.novoSlug().trim();
    this.salvando.set(true);
    this.erro.set(null);
    this.adminCategoriaService
      .criar({
        id: slug,
        nome: this.novoNome().trim(),
        slug,
        corTema: this.novaCorTema(),
        icone: this.novoIcone().trim(),
        descricaoCurta: this.novaDescricao().trim(),
      })
      .subscribe({
        next: (categoria) => {
          this.categorias.update((atual) => [...atual, categoria]);
          this.salvando.set(false);
          this.novoNome.set('');
          this.novoSlug.set('');
          this.slugEditadoManualmente.set(false);
          this.novaCorTema.set('#7b2ff7');
          this.novoIcone.set('');
          this.novaDescricao.set('');
        },
        error: () => {
          this.salvando.set(false);
          this.erro.set(
            'Não foi possível criar a categoria — confira se o slug já não está em uso.'
          );
        },
      });
  }

  iniciarEdicao(categoria: Categoria): void {
    this.idEmEdicao.set(categoria.id);
    this.edNome.set(categoria.nome);
    this.edSlug.set(categoria.slug);
    this.edCorTema.set(categoria.corTema);
    this.edIcone.set(categoria.icone);
    this.edDescricao.set(categoria.descricaoCurta);
  }

  cancelarEdicao(): void {
    this.idEmEdicao.set(null);
  }

  salvarEdicao(categoria: Categoria): void {
    this.salvando.set(true);
    this.erro.set(null);
    this.adminCategoriaService
      .atualizar({
        ...categoria,
        nome: this.edNome().trim(),
        slug: this.edSlug().trim(),
        corTema: this.edCorTema(),
        icone: this.edIcone().trim(),
        descricaoCurta: this.edDescricao().trim(),
      })
      .subscribe({
        next: (categoriaAtualizada) => {
          this.categorias.update((atual) =>
            atual.map((c) => (c.id === categoria.id ? categoriaAtualizada : c))
          );
          this.salvando.set(false);
          this.idEmEdicao.set(null);
        },
        error: () => {
          this.salvando.set(false);
          this.erro.set(`Não foi possível salvar "${categoria.nome}".`);
        },
      });
  }

  quantidadeProdutos(categoria: Categoria): number {
    return this.produtosPorCategoria()[categoria.slug] ?? 0;
  }

  excluir(categoria: Categoria): void {
    const emUso = this.quantidadeProdutos(categoria);
    if (emUso > 0) {
      this.erro.set(
        `"${categoria.nome}" está em uso em ${emUso} produto${emUso > 1 ? 's' : ''} — tire a categoria desses produtos antes de excluir.`
      );
      return;
    }
    if (!confirm(`Excluir a categoria "${categoria.nome}"? Essa ação não pode ser desfeita.`)) {
      return;
    }

    this.idExcluindo.set(categoria.id);
    this.erro.set(null);
    this.adminCategoriaService.excluir(categoria.id).subscribe({
      next: () => {
        this.categorias.update((atual) => atual.filter((c) => c.id !== categoria.id));
        this.idExcluindo.set(null);
      },
      error: () => {
        this.erro.set(`Não foi possível excluir "${categoria.nome}".`);
        this.idExcluindo.set(null);
      },
    });
  }
}
