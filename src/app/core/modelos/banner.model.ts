export interface Banner {
  id: string;
  imagemUrl: string;
  alt: string;
  /** Rota interna opcional pra onde o banner leva ao ser clicado (ex.: '/categoria/geek'). */
  link?: string;
}
