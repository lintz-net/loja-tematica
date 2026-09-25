import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CarrinhoService } from './carrinho.service';
import { CatalogoRepositorio } from './catalogo.repositorio';
import { Produto, VarianteProduto } from '../modelos/produto.model';

const CHAVE_ARMAZENAMENTO = 'vistanostalgica:carrinho';

function criarVariante(sobrescritas: Partial<VarianteProduto> = {}): VarianteProduto {
  return {
    id: 'var-1',
    produtoId: 'prod-1',
    sku: 'SKU-1',
    tamanho: 'M',
    cor: 'Preto',
    quantidadeEstoque: 10,
    ...sobrescritas,
  };
}

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Teste',
    slug: 'camiseta-teste',
    descricao: 'Descrição',
    precoBase: 50,
    categorias: ['geek'],
    imagens: ['/foto.webp'],
    variantes: [criarVariante()],
    destaque: false,
    ...sobrescritas,
  };
}

@Component({ template: '', standalone: true })
class HostVazioComponent {}

describe('CarrinhoService', () => {
  let service: CarrinhoService;
  let fixture: ComponentFixture<HostVazioComponent>;
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;

  beforeEach(() => {
    localStorage.removeItem(CHAVE_ARMAZENAMENTO);
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', ['obterProdutos']);
    catalogoRepositorioSpy.obterProdutos.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [HostVazioComponent],
      providers: [{ provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy }],
    });

    fixture = TestBed.createComponent(HostVazioComponent);
    service = TestBed.inject(CarrinhoService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(CHAVE_ARMAZENAMENTO);
  });

  it('começa vazio', () => {
    expect(service.itensCarrinho()).toEqual([]);
    expect(service.quantidadeTotalItens()).toBe(0);
    expect(service.valorTotal()).toBe(0);
  });

  it('adiciona um item novo e abre a gaveta', () => {
    const produto = criarProduto();
    const variante = produto.variantes[0];

    service.adicionarItem(produto, variante, 2);

    expect(service.itensCarrinho().length).toBe(1);
    expect(service.itensCarrinho()[0].quantidade).toBe(2);
    expect(service.gavetaAberta()).toBeTrue();
  });

  it('somar quantidade em vez de duplicar quando a variante já está no carrinho', () => {
    const produto = criarProduto();
    const variante = produto.variantes[0];

    service.adicionarItem(produto, variante, 1);
    service.adicionarItem(produto, variante, 3);

    expect(service.itensCarrinho().length).toBe(1);
    expect(service.itensCarrinho()[0].quantidade).toBe(4);
  });

  it('trata variantes diferentes do mesmo produto como itens separados', () => {
    const produto = criarProduto();
    const varianteM = criarVariante({ id: 'var-m', tamanho: 'M' });
    const varianteG = criarVariante({ id: 'var-g', tamanho: 'G' });

    service.adicionarItem(produto, varianteM, 1);
    service.adicionarItem(produto, varianteG, 1);

    expect(service.itensCarrinho().length).toBe(2);
  });

  it('calcula valorTotal usando precoBase quando não há precoOverride', () => {
    const produto = criarProduto({ precoBase: 30 });
    service.adicionarItem(produto, produto.variantes[0], 3);

    expect(service.valorTotal()).toBe(90);
  });

  it('calcula valorTotal usando precoOverride da variante quando presente', () => {
    const produto = criarProduto({ precoBase: 30 });
    const variante = criarVariante({ precoOverride: 45 });
    service.adicionarItem(produto, variante, 2);

    expect(service.valorTotal()).toBe(90);
  });

  it('soma valorTotal e quantidadeTotalItens entre vários itens', () => {
    const produto = criarProduto({ precoBase: 20 });
    service.adicionarItem(produto, criarVariante({ id: 'v1' }), 2); // 40
    service.adicionarItem(produto, criarVariante({ id: 'v2', precoOverride: 25 }), 1); // 25

    expect(service.valorTotal()).toBe(65);
    expect(service.quantidadeTotalItens()).toBe(3);
  });

  it('removerItem tira só a variante indicada', () => {
    const produto = criarProduto();
    service.adicionarItem(produto, criarVariante({ id: 'v1' }), 1);
    service.adicionarItem(produto, criarVariante({ id: 'v2' }), 1);

    service.removerItem('v1');

    expect(service.itensCarrinho().length).toBe(1);
    expect(service.itensCarrinho()[0].variante.id).toBe('v2');
  });

  it('atualizarQuantidade muda a quantidade de uma variante existente', () => {
    const produto = criarProduto();
    const variante = criarVariante();
    service.adicionarItem(produto, variante, 1);

    service.atualizarQuantidade(variante.id, 5);

    expect(service.itensCarrinho()[0].quantidade).toBe(5);
  });

  it('atualizarQuantidade com valor zero ou negativo remove o item', () => {
    const produto = criarProduto();
    const variante = criarVariante();
    service.adicionarItem(produto, variante, 1);

    service.atualizarQuantidade(variante.id, 0);

    expect(service.itensCarrinho().length).toBe(0);
  });

  it('limparCarrinho esvazia tudo', () => {
    const produto = criarProduto();
    service.adicionarItem(produto, criarVariante({ id: 'v1' }), 1);
    service.adicionarItem(produto, criarVariante({ id: 'v2' }), 1);

    service.limparCarrinho();

    expect(service.itensCarrinho()).toEqual([]);
    expect(service.valorTotal()).toBe(0);
  });

  describe('gaveta', () => {
    it('abrirGaveta/fecharGaveta/alternarGaveta controlam o estado', () => {
      expect(service.gavetaAberta()).toBeFalse();

      service.abrirGaveta();
      expect(service.gavetaAberta()).toBeTrue();

      service.fecharGaveta();
      expect(service.gavetaAberta()).toBeFalse();

      service.alternarGaveta();
      expect(service.gavetaAberta()).toBeTrue();
      service.alternarGaveta();
      expect(service.gavetaAberta()).toBeFalse();
    });
  });

  describe('persistência no localStorage', () => {
    it('salva produtoId/varianteId/quantidade depois de adicionar um item', () => {
      const produto = criarProduto();
      const variante = criarVariante();
      service.adicionarItem(produto, variante, 2);
      fixture.detectChanges(); // flush do effect() que persiste no localStorage

      const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO) ?? '[]');
      expect(salvo).toEqual([{ produtoId: produto.id, varianteId: variante.id, quantidade: 2 }]);
    });

    it('restaura o carrinho salvo, casando com o catálogo atual (preço/estoque frescos)', () => {
      const produtoAtual = criarProduto({ precoBase: 99 }); // preço "atualizado" no catálogo
      localStorage.setItem(
        CHAVE_ARMAZENAMENTO,
        JSON.stringify([{ produtoId: produtoAtual.id, varianteId: produtoAtual.variantes[0].id, quantidade: 3 }])
      );
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produtoAtual]));

      // Precisa de uma instância nova pra rodar o construtor com esse localStorage já preenchido.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HostVazioComponent],
        providers: [{ provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy }],
      });
      const fixture2 = TestBed.createComponent(HostVazioComponent);
      const service2 = TestBed.inject(CarrinhoService);
      fixture2.detectChanges();

      expect(service2.itensCarrinho().length).toBe(1);
      expect(service2.itensCarrinho()[0].quantidade).toBe(3);
      expect(service2.valorTotal()).toBe(297); // 99 * 3 — veio do catálogo "atual", não de um valor salvo
    });

    it('ignora item salvo cujo produto/variante não existe mais no catálogo', () => {
      localStorage.setItem(
        CHAVE_ARMAZENAMENTO,
        JSON.stringify([{ produtoId: 'produto-descontinuado', varianteId: 'var-x', quantidade: 1 }])
      );
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([])); // catálogo atual não tem mais esse produto

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HostVazioComponent],
        providers: [{ provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy }],
      });
      const fixture2 = TestBed.createComponent(HostVazioComponent);
      const service2 = TestBed.inject(CarrinhoService);
      fixture2.detectChanges();

      expect(service2.itensCarrinho()).toEqual([]);
    });

    it('localStorage corrompido (JSON inválido) não quebra, carrinho começa vazio', () => {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, '{isso não é json válido');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HostVazioComponent],
        providers: [{ provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy }],
      });
      const fixture2 = TestBed.createComponent(HostVazioComponent);
      const service2 = TestBed.inject(CarrinhoService);
      fixture2.detectChanges();

      expect(service2.itensCarrinho()).toEqual([]);
      expect(catalogoRepositorioSpy.obterProdutos).not.toHaveBeenCalled();
    });
  });
});
