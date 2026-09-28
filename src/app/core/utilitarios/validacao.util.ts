/** Validações de verdade (dígito verificador, checksum), não só formato — complementam as
 * máscaras de `mascara.util.ts`, que só cuidam de como o campo aparece enquanto digita. */

/** Algoritmo padrão de dígito verificador do CPF (dois dígitos, cada um com seu próprio
 * cálculo de módulo 11). Rejeita sequências repetidas (111.111.111-11 etc.) — matematicamente
 * "válidas" pelo cálculo, mas nunca são CPF real, e são o primeiro chute de quem só quer
 * passar pela validação sem digitar um documento de verdade. */
export function validarCpf(valor: string): boolean {
  const cpf = valor.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  for (const posicaoFinal of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < posicaoFinal; i++) {
      soma += Number(cpf[i]) * (posicaoFinal + 1 - i);
    }
    const resto = (soma * 10) % 11;
    const digitoEsperado = resto === 10 ? 0 : resto;
    if (digitoEsperado !== Number(cpf[posicaoFinal])) return false;
  }
  return true;
}

/** Mesma ideia do CPF, mas com os pesos alternados (2 a 9) que o CNPJ usa. */
export function validarCnpj(valor: string): boolean {
  const cnpj = valor.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcularDigito = (base: string): number => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base
      .split('')
      .reduce((acc, digito, indice) => acc + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiroDigito = calcularDigito(cnpj.slice(0, 12));
  const segundoDigito = calcularDigito(cnpj.slice(0, 12) + primeiroDigito);
  return primeiroDigito === Number(cnpj[12]) && segundoDigito === Number(cnpj[13]);
}

/** CPF (11 dígitos) ou CNPJ (14) — decide qual checar pela quantidade de dígitos. */
export function validarDocumento(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 11) return validarCpf(digitos);
  if (digitos.length === 14) return validarCnpj(digitos);
  return false;
}
