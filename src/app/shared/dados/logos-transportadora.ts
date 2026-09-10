export interface LogoTransportadora {
  alt: string;
  arquivo: string;
}

/** Arquivos em public/imagens/envio — baixados do site oficial de cada transportadora. */
export const LOGOS_TRANSPORTADORA: LogoTransportadora[] = [
  { alt: 'Correios', arquivo: 'correios.webp' },
  { alt: 'Jadlog', arquivo: 'jadlog.webp' },
  { alt: 'Loggi', arquivo: 'loggi.webp' },
  { alt: 'Buslog', arquivo: 'buslog.webp' },
  { alt: 'J&T Express', arquivo: 'jt-express.webp' },
  { alt: 'LATAM Cargo', arquivo: 'latam.webp' },
];

/** Casa o nome da transportadora — vem dinâmico da cotação do Melhor Envio (ex.: "Jadlog",
 * ".Com" como serviço da Jadlog) — com um logo salvo. Comparação sem acento/case pra
 * tolerar variações pequenas de grafia; devolve `null` quando não tem logo pra essa
 * transportadora (quem chama cai pro nome em texto). */
export function obterLogoTransportadora(nome: string | undefined | null): LogoTransportadora | null {
  if (!nome) return null;
  const normalizado = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  return (
    LOGOS_TRANSPORTADORA.find((logo) => normalizado.includes(logo.alt.toLowerCase())) ?? null
  );
}
