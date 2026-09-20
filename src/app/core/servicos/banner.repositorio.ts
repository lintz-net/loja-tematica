import { Observable } from 'rxjs';
import { Banner, DestinoBanner } from '../modelos/banner.model';

/**
 * Contrato de acesso aos banners do carrossel da home. Mesmo padrão do CatalogoRepositorio:
 * a implementação concreta (mock ou API real) é decidida em app.config.ts via `environment.useMock`.
 */
export abstract class BannerRepositorio {
  /** Sem `destino`, traz todos os banners (uso interno do admin). Com `destino`, filtra —
   * ex.: `obterBanners('home')` pro carrossel da home, `obterBanners('menu')` pro mega-menu. */
  abstract obterBanners(destino?: DestinoBanner): Observable<Banner[]>;
}
