import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { CatalogoRepositorio } from './core/servicos/catalogo.repositorio';
import { CatalogoMockService } from './core/servicos/catalogo-mock.service';
import { CatalogoApiService } from './core/servicos/catalogo-api.service';
import { BannerRepositorio } from './core/servicos/banner.repositorio';
import { BannerMockService } from './core/servicos/banner-mock.service';
import { BannerApiService } from './core/servicos/banner-api.service';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    provideHttpClient(),
    {
      provide: CatalogoRepositorio,
      useClass: environment.useMock ? CatalogoMockService : CatalogoApiService,
    },
    {
      provide: BannerRepositorio,
      useClass: environment.useMock ? BannerMockService : BannerApiService,
    }, provideClientHydration(withEventReplay()),
  ],
};
