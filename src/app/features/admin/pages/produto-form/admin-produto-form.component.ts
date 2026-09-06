import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogoRepositorio } from '../../../../core/servicos/catalogo.repositorio';
import { AdminProdutoService } from '../../../../core/servicos/admin-produto.service';
import { Categoria, SlugCategoria } from '../../../../core/modelos/categoria.model';
import { Produto, VarianteProduto } from '../../../../core/modelos/produto.model';
import { CORES_CONHECIDAS, corParaEstiloSwatch } from '../../../../core/utilitarios/cor.util';

const TAMANHOS_PADRAO = ['P', 'M', 'G', 'GG', 'Único'];
const ESTOQUE_PADRAO = 10;

function gerarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface LinhaVariante {
  id: string;
  tamanho: string;
  cor: string;
  quantidadeEstoque: number;
  precoOverride: number | null;
}

@Component({
  selector: 'app-admin-produto-form',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-produto-form.component.html',
  styleUrl: './admin-produto-form.component.scss',
})
export class AdminProdutoFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogoRepositorio = inject(CatalogoRepositorio);
  private readonly adminProdutoService = inject(AdminProdutoService);

  private readonly idEdicao = this.route.snapshot.paramMap.get('id');
  readonly modoEdicao = this.idEdicao !== null;

  readonly carregando = signal(this.modoEdicao);
  readonly salvando = signal(false);
  readonly enviandoImagem = signal(false);
  readonly erro = signal<string | null>(null);

  readonly categoriasDisponiveis = signal<Categoria[]>([]);
  readonly tamanhosPadrao = TAMANHOS_PADRAO;
  readonly coresConhecidas = CORES_CONHECIDAS;
  readonly corParaEstiloSwatch = corParaEstiloSwatch;

  readonly nome = signal('');
  readonly slug = signal('');
  readonly slugEditadoManualmente = signal(false);
  readonly descricao = signal('');
  readonly precoBase = signal(0);
  readonly categoriasSelecionadas = signal<Set<SlugCategoria>>(new Set());
  readonly imagens = signal<string[]>([]);

  /** Tamanhos/cores marcados nos checkboxes — usados só pra gerar a matriz de variantes,
   * não são salvos diretamente. */
  readonly tamanhosMarcados = signal<Set<string>>(new Set());
  readonly coresMarcadas = signal<Set<string>>(new Set());

  readonly variantes = signal<LinhaVariante[]>([]);

  /** Mapa cor → fotos específicas daquela cor (opcional) — quando preenchido pra uma cor, a
   * galeria do produto pula pra essas fotos ao selecioná-la em vez de mostrar todas. */
  readonly imagensPorCor = signal<Record<string, string[]>>({});

  constructor() {
    this.catalogoRepositorio.obterCategorias().subscribe((categorias) => {
      this.categoriasDisponiveis.set(categorias);
    });

    if (this.idEdicao) {
      this.adminProdutoService.obterPorId(this.idEdicao).subscribe({
        next: (produto) => {
          if (!produto) {
            this.erro.set('Produto não encontrado.');
            this.carregando.set(false);
            return;
          }
          this.preencherFormulario(produto);
          this.carregando.set(false);
        },
        error: () => {
          this.erro.set('Não foi possível carregar o produto.');
          this.carregando.set(false);
        },
      });
    }
  }

  private preencherFormulario(produto: Produto): void {
    this.nome.set(produto.nome);
    this.slug.set(produto.slug);
    this.slugEditadoManualmente.set(true);
    this.descricao.set(produto.descricao);
    this.precoBase.set(produto.precoBase);
    this.categoriasSelecionadas.set(new Set(produto.categorias));
    this.imagens.set(produto.imagens);

    const variantesExistentes = produto.variantes.map((v) => ({
      id: v.id,
      tamanho: v.tamanho,
      cor: v.cor,
      quantidadeEstoque: v.quantidadeEstoque,
      precoOverride: v.precoOverride ?? null,
    }));
    this.variantes.set(variantesExistentes);
    this.tamanhosMarcados.set(new Set(variantesExistentes.map((v) => v.tamanho)));
    this.coresMarcadas.set(new Set(variantesExistentes.map((v) => v.cor)));
    this.imagensPorCor.set(produto.imagensPorCor ?? {});
  }

  atualizarNome(valor: string): void {
    this.nome.set(valor);
    if (!this.slugEditadoManualmente()) {
      this.slug.set(gerarSlug(valor));
    }
  }

  atualizarSlug(valor: string): void {
    this.slugEditadoManualmente.set(true);
    this.slug.set(gerarSlug(valor));
  }

  atualizarDescricao(valor: string): void {
    this.descricao.set(valor);
  }

  atualizarPrecoBase(valor: string): void {
    this.precoBase.set(Number(valor) || 0);
  }

  alternarCategoria(slug: SlugCategoria, marcado: boolean): void {
    this.categoriasSelecionadas.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(slug);
      else novo.delete(slug);
      return novo;
    });
  }

  categoriaSelecionada(slug: SlugCategoria): boolean {
    return this.categoriasSelecionadas().has(slug);
  }

  removerImagem(url: string): void {
    this.imagens.update((atual) => atual.filter((i) => i !== url));
    this.imagensPorCor.update((atual) => {
      const novo: Record<string, string[]> = {};
      for (const [cor, urls] of Object.entries(atual)) {
        novo[cor] = urls.filter((u) => u !== url);
      }
      return novo;
    });
  }

  imagemMarcadaParaCor(cor: string, url: string): boolean {
    return (this.imagensPorCor()[cor] ?? []).includes(url);
  }

  alternarImagemDaCor(cor: string, url: string, marcado: boolean): void {
    this.imagensPorCor.update((atual) => {
      const atuais = atual[cor] ?? [];
      const novas = marcado ? [...atuais, url] : atuais.filter((u) => u !== url);
      return { ...atual, [cor]: novas };
    });
  }

  aoSelecionarArquivos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivos = input.files;
    if (!arquivos || arquivos.length === 0 || !this.slug()) return;

    this.enviandoImagem.set(true);
    let restantes = arquivos.length;

    for (const arquivo of Array.from(arquivos)) {
      this.adminProdutoService.enviarImagem(this.slug(), arquivo).subscribe({
        next: (url) => {
          this.imagens.update((atual) => [...atual, url]);
          restantes--;
          if (restantes === 0) this.enviandoImagem.set(false);
        },
        error: () => {
          this.erro.set(`Falha ao enviar a imagem "${arquivo.name}".`);
          restantes--;
          if (restantes === 0) this.enviandoImagem.set(false);
        },
      });
    }
    input.value = '';
  }

  alternarTamanho(tamanho: string, marcado: boolean): void {
    this.tamanhosMarcados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(tamanho);
      else novo.delete(tamanho);
      return novo;
    });
  }

  alternarCor(cor: string, marcado: boolean): void {
    this.coresMarcadas.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(cor);
      else novo.delete(cor);
      return novo;
    });
  }

  /** Monta a matriz tamanho×cor a partir dos checkboxes marcados. Combinações que já
   * existiam mantêm estoque/preço; combinações novas entram com estoque padrão; combinações
   * desmarcadas somem. Evita variantes com tamanho/cor digitados livremente (a causa da
   * seleção ficar "travada" no carrinho quando a matriz vem incompleta/inconsistente). */
  gerarVariantes(): void {
    const tamanhos = Array.from(this.tamanhosMarcados());
    const cores = Array.from(this.coresMarcadas());
    if (tamanhos.length === 0 || cores.length === 0) return;

    const existentesPorChave = new Map(
      this.variantes().map((v) => [`${v.tamanho}::${v.cor}`, v])
    );

    const novasVariantes: LinhaVariante[] = [];
    let contador = 1;
    for (const tamanho of tamanhos) {
      for (const cor of cores) {
        const chave = `${tamanho}::${cor}`;
        const existente = existentesPorChave.get(chave);
        novasVariantes.push(
          existente ?? {
            id: `${this.slug() || 'novo'}-v${contador}-${Date.now()}`,
            tamanho,
            cor,
            quantidadeEstoque: ESTOQUE_PADRAO,
            precoOverride: null,
          }
        );
        contador++;
      }
    }

    this.variantes.set(novasVariantes);
  }

  atualizarVariante(id: string, campo: 'quantidadeEstoque' | 'precoOverride', valor: string): void {
    this.variantes.update((atual) =>
      atual.map((v) => {
        if (v.id !== id) return v;
        if (campo === 'quantidadeEstoque') return { ...v, quantidadeEstoque: Number(valor) || 0 };
        return { ...v, precoOverride: valor ? Number(valor) : null };
      })
    );
  }

  podeSalvar(): boolean {
    return (
      this.nome().trim().length > 0 &&
      this.slug().trim().length > 0 &&
      this.categoriasSelecionadas().size > 0 &&
      this.imagens().length > 0 &&
      this.variantes().length > 0 &&
      !this.enviandoImagem()
    );
  }

  salvar(): void {
    if (!this.podeSalvar()) return;

    const id = this.modoEdicao ? this.idEdicao! : this.slug();

    const imagensPorCorPreenchido = Object.fromEntries(
      Object.entries(this.imagensPorCor()).filter(([, urls]) => urls.length > 0)
    );

    const produto: Produto = {
      id,
      nome: this.nome().trim(),
      slug: this.slug().trim(),
      descricao: this.descricao().trim(),
      precoBase: this.precoBase(),
      categorias: Array.from(this.categoriasSelecionadas()),
      imagens: this.imagens(),
      imagensPorCor:
        Object.keys(imagensPorCorPreenchido).length > 0 ? imagensPorCorPreenchido : undefined,
      variantes: this.variantes().map(
        (v): VarianteProduto => ({
          id: v.id,
          produtoId: id,
          sku: `${this.slug()}-${v.tamanho}-${v.cor}`.toUpperCase().replace(/\s+/g, ''),
          tamanho: v.tamanho,
          cor: v.cor,
          quantidadeEstoque: v.quantidadeEstoque,
          precoOverride: v.precoOverride ?? undefined,
        })
      ),
    };

    this.salvando.set(true);
    this.erro.set(null);
    const operacao = this.modoEdicao
      ? this.adminProdutoService.atualizar(produto)
      : this.adminProdutoService.criar(produto);

    operacao.subscribe({
      next: () => this.router.navigate(['/admin/produtos']),
      error: (erro) => {
        this.salvando.set(false);
        this.erro.set(
          erro?.message?.includes('duplicate')
            ? 'Já existe um produto com esse identificador/slug.'
            : 'Não foi possível salvar o produto.'
        );
      },
    });
  }
}
