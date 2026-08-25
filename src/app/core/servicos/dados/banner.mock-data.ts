import { Banner } from '../../modelos/banner.model';

export const BANNERS: Banner[] = [
  {
    id: 'banner-01',
    imagemUrl: '/imagens/carrossel/frete-gratis-brasil.webp',
    alt: 'Frete grátis para todo o Brasil',
  },
  {
    id: 'banner-02',
    imagemUrl: '/imagens/carrossel/frete-gratis-150.webp',
    alt: 'Frete grátis para todo o Brasil em compras acima de R$150',
    link: '/categoria/geek',
  },
  {
    id: 'banner-03',
    imagemUrl: '/imagens/carrossel/promo-4x-camisetas.webp',
    alt: 'Promoção 4 camisetas por R$180',
    link: '/categoria/automotivo',
  },
];
