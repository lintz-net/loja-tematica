import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { CatalogoRepositorio } from './core/servicos/catalogo.repositorio';
import { CatalogoApiService } from './core/servicos/catalogo-api.service';
import { BannerRepositorio } from './core/servicos/banner.repositorio';
import { BannerApiService } from './core/servicos/banner-api.service';
import { ConfiguracaoLojaService } from './core/servicos/configuracao-loja.service';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    /** withFetch: sem isso, o HttpClient usa xhr2 no servidor, que depende de `Buffer` —
     * indisponível no runtime Deno das Edge Functions do Netlify ("Buffer is not defined").
     * O backend fetch nativo funciona em Node, Deno e browser sem essa dependência, e
     * continua sendo rastreado corretamente pelo Zone.js pra estabilidade do SSR (ao
     * contrário de chamar `fetch` diretamente, sem passar pelo HttpClient). */
    provideHttpClient(withFetch()),
    { provide: CatalogoRepositorio, useClass: CatalogoApiService },
    { provide: BannerRepositorio, useClass: BannerApiService },
    /** Busca a identidade da loja (nome, contato, redes sociais) uma única vez, antes do app
     * terminar de inicializar — ver comentário em ConfiguracaoLojaService sobre por que isso
     * importa pra hidratação (NG0506) em vez de cada componente buscar por conta própria. */
    provideAppInitializer(() => firstValueFrom(inject(ConfiguracaoLojaService).carregarInicial())),
    provideClientHydration(withEventReplay()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
