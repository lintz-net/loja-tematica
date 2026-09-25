import { Component, PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FavoritosService } from './favoritos.service';
import { CatalogoRepositorio } from './catalogo.repositorio';
import { Produto } from '../modelos/produto.model';

const CHAVE_ARMAZENAMENTO = 'vistanostalgica:favoritos';

function criarProduto(sobrescritas: Partial<Produto> = {}): Produto {
  return {
    id: 'prod-1',
    nome: 'Camiseta Teste',
    slug: 'camiseta-teste',
    descricao: 'Descrição',
    precoBase: 50,
    categorias: ['geek'],
    imagens: ['/foto.webp'],
    variantes: [],
    destaque: false,
    ...sobrescritas,
  };
}

@Component({ template: '', standalone: true })
class HostVazioComponent {}

describe('FavoritosService', () => {
  let service: FavoritosService;
  let fixture: ComponentFixture<HostVazioComponent>;
  let catalogoRepositorioSpy: jasmine.SpyObj<CatalogoRepositorio>;

  function criarInstancia(): { fixture: ComponentFixture<HostVazioComponent>; service: FavoritosService } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostVazioComponent],
      providers: [{ provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy }],
    });
    const f = TestBed.createComponent(HostVazioComponent);
    const s = TestBed.inject(FavoritosService);
    f.detectChanges();
    return { fixture: f, service: s };
  }

  beforeEach(() => {
    localStorage.removeItem(CHAVE_ARMAZENAMENTO);
    catalogoRepositorioSpy = jasmine.createSpyObj('CatalogoRepositorio', ['obterProdutos']);
    catalogoRepositorioSpy.obterProdutos.and.returnValue(of([]));

    ({ fixture, service } = criarInstancia());
  });

  afterEach(() => {
    localStorage.removeItem(CHAVE_ARMAZENAMENTO);
  });

  it('começa sem favoritos', () => {
    expect(service.quantidadeFavoritos()).toBe(0);
    expect(service.produtosFavoritos()).toEqual([]);
  });

  it('alternar favorita um produto não favoritado', () => {
    const produto = criarProduto();
    service.alternar(produto);

    expect(service.estaFavoritado(produto.id)).toBeTrue();
    expect(service.quantidadeFavoritos()).toBe(1);
    expect(service.produtosFavoritos()).toEqual([produto]);
  });

  it('alternar desfavorita um produto já favoritado', () => {
    const produto = criarProduto();
    service.alternar(produto);
    service.alternar(produto);

    expect(service.estaFavoritado(produto.id)).toBeFalse();
    expect(service.quantidadeFavoritos()).toBe(0);
    expect(service.produtosFavoritos()).toEqual([]);
  });

  it('remover tira um produto favoritado pelo id', () => {
    const produtoA = criarProduto({ id: 'a' });
    const produtoB = criarProduto({ id: 'b' });
    service.alternar(produtoA);
    service.alternar(produtoB);

    service.remover('a');

    expect(service.estaFavoritado('a')).toBeFalse();
    expect(service.estaFavoritado('b')).toBeTrue();
    expect(service.quantidadeFavoritos()).toBe(1);
  });

  it('remover um id que não está favoritado não quebra nem muda nada', () => {
    const produto = criarProduto();
    service.alternar(produto);

    service.remover('nao-existe');

    expect(service.quantidadeFavoritos()).toBe(1);
  });

  describe('persistência no localStorage', () => {
    it('salva os ids depois de alternar', () => {
      const produto = criarProduto();
      service.alternar(produto);
      fixture.detectChanges(); // flush do effect()

      const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO) ?? '[]');
      expect(salvo).toEqual([produto.id]);
    });

    it('restaura os favoritos salvos, casando com o catálogo atual', () => {
      const produto = criarProduto({ id: 'prod-salvo' });
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(['prod-salvo']));
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([produto]));

      ({ fixture, service } = criarInstancia());

      expect(service.estaFavoritado('prod-salvo')).toBeTrue();
      expect(service.produtosFavoritos()).toEqual([produto]);
    });

    it('ids salvos que não têm mais produto no catálogo somem da lista completa, mas o id continua marcado', () => {
      // idsFavoritos é setado de imediato a partir do localStorage, antes do catálogo
      // resolver — então estaFavoritado() já reflete o id salvo mesmo que o produto tenha
      // sido descontinuado; só a lista completa (produtosFavoritos) filtra pelo catálogo.
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(['produto-descontinuado']));
      catalogoRepositorioSpy.obterProdutos.and.returnValue(of([]));

      ({ fixture, service } = criarInstancia());

      expect(service.estaFavoritado('produto-descontinuado')).toBeTrue();
      expect(service.produtosFavoritos()).toEqual([]);
    });

    it('localStorage corrompido não quebra, começa sem favoritos', () => {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, '{json inválido');

      ({ fixture, service } = criarInstancia());

      expect(service.quantidadeFavoritos()).toBe(0);
      expect(catalogoRepositorioSpy.obterProdutos).not.toHaveBeenCalled();
    });
  });

  describe('SSR (servidor)', () => {
    it('não toca no localStorage ao restaurar nem ao salvar quando não está no browser', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HostVazioComponent],
        providers: [
          { provide: CatalogoRepositorio, useValue: catalogoRepositorioSpy },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      const setItemSpy = spyOn(Storage.prototype, 'setItem').and.callThrough();
      const f = TestBed.createComponent(HostVazioComponent);
      const s = TestBed.inject(FavoritosService);
      f.detectChanges();

      expect(catalogoRepositorioSpy.obterProdutos).not.toHaveBeenCalled();
      expect(s.quantidadeFavoritos()).toBe(0);

      s.alternar(criarProduto());
      f.detectChanges();

      expect(setItemSpy).not.toHaveBeenCalledWith(CHAVE_ARMAZENAMENTO, jasmine.any(String));
    });
  });
});
