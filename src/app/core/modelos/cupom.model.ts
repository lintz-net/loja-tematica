export type TipoDescontoCupom = 'percentual' | 'valor_fixo';

export interface Cupom {
  codigo: string;
  tipoDesconto: TipoDescontoCupom;
  valorDesconto: number;
  /** null/ausente = nunca expira. */
  expiraEm?: string;
  ativo: boolean;
  criadoEm: string;
}
