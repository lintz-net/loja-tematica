/** 'home' é o carrossel da página inicial (comportamento de sempre); 'menu' é o banner
 * promocional exibido dentro do mega-menu "Produtos" do cabeçalho. */
export type DestinoBanner = 'home' | 'menu';

export interface Banner {
  id: string;
  imagemUrl: string;
  alt: string;
  /** Rota interna opcional pra onde o banner leva ao ser clicado (ex.: '/categoria/algum-slug'). */
  link?: string;
  destino: DestinoBanner;
  /** Define a ordem de exibição no carrossel da home e, para banners de destino 'menu',
   * qual banner aparece no mega-menu quando há mais de um (usa sempre o de maior ordem). */
  ordem: number;
}
