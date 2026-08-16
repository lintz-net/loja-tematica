import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/catalogo/pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'categoria/:slug',
    loadComponent: () =>
      import('./features/catalogo/pages/listagem/listagem.component').then(
        (m) => m.ListagemComponent
      ),
  },
  {
    path: 'produto/:slug',
    loadComponent: () =>
      import('./features/catalogo/pages/detalhe-produto/detalhe-produto.component').then(
        (m) => m.DetalheProdutoComponent
      ),
  },
  {
    path: 'carrinho',
    loadComponent: () =>
      import('./features/carrinho/pages/carrinho/carrinho.component').then(
        (m) => m.CarrinhoComponent
      ),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./features/checkout/pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent
      ),
  },
  {
    path: 'conta',
    loadComponent: () =>
      import('./features/conta/pages/conta/conta.component').then((m) => m.ContaComponent),
  },
  { path: '**', redirectTo: '' },
];
