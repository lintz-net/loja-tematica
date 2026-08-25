import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Banner } from '../modelos/banner.model';
import { BannerRepositorio } from './banner.repositorio';

@Injectable()
export class BannerApiService implements BannerRepositorio {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  obterBanners(): Observable<Banner[]> {
    return this.http.get<Banner[]>(`${this.baseUrl}/banners`);
  }
}
