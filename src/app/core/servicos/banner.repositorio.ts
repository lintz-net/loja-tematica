import { Observable } from 'rxjs';
import { Banner } from '../modelos/banner.model';

/**
 * Contrato de acesso aos banners do carrossel da home. Mesmo padrão do CatalogoRepositorio:
 * a implementação concreta (mock ou API real) é decidida em app.config.ts via `environment.useMock`.
 */
export abstract class BannerRepositorio {
  abstract obterBanners(): Observable<Banner[]>;
}
