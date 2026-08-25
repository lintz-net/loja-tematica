import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Banner } from '../modelos/banner.model';
import { BannerRepositorio } from './banner.repositorio';
import { BANNERS } from './dados/banner.mock-data';

@Injectable()
export class BannerMockService implements BannerRepositorio {
  obterBanners(): Observable<Banner[]> {
    return of(BANNERS).pipe(delay(environment.mockDelayMs));
  }
}
