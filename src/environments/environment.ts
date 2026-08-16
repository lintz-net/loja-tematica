export const environment = {
  production: false,
  /** Quando true, usa CatalogoMockService (dados em memória). Quando false, usa CatalogoApiService (HttpClient). */
  useMock: true,
  apiUrl: '/api',
  /** Latência artificial do mock, em ms, para simular uma chamada de rede real. */
  mockDelayMs: 400,
};
