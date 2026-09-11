/** Máscaras simples pra campos de formulário — sempre reconstroem a partir só dos dígitos
 * (sem estado de cursor sofisticado), então digitar/apagar no meio do campo pode reposicionar
 * o cursor no fim; comportamento aceitável pra campos curtos como estes. */

export function mascararCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export function mascararTelefone(valor: string): string {
  let digitos = valor.replace(/\D/g, '');
  // Autopreenchimento do navegador às vezes inclui o código do país (+55) — um número de
  // celular/fixo brasileiro tem no máximo 11 dígitos (DDD + 9 dígitos), então mais que isso
  // começando com 55 só pode ser o código do país grudado na frente.
  if (digitos.length > 11 && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  // Fixo tem 8 dígitos após o DDD, celular 9 — o separador do meio muda de posição sozinho
  // conforme o total de dígitos.
  const finalDoMeio = digitos.length > 10 ? 7 : 6;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, finalDoMeio)}-${digitos.slice(finalDoMeio)}`;
}

/** CPF (11 dígitos) ou CNPJ (14) — o formato muda sozinho conforme a quantidade digitada. */
export function mascararDocumento(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);

  if (digitos.length <= 11) {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    .slice(0, 18);
}
