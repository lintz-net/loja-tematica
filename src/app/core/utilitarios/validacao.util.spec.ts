import {
  validarCnpj,
  validarCpf,
  validarDocumento,
  validarNumeroCartao,
  validarValidadeCartao,
} from './validacao.util';

describe('validarCpf', () => {
  it('aceita um CPF com dígito verificador correto', () => {
    expect(validarCpf('123.456.789-09')).toBeTrue();
    expect(validarCpf('12345678909')).toBeTrue();
  });

  it('rejeita dígito verificador errado', () => {
    expect(validarCpf('12345678900')).toBeFalse();
  });

  it('rejeita sequência repetida, mesmo que "passe" no cálculo', () => {
    expect(validarCpf('11111111111')).toBeFalse();
  });

  it('rejeita tamanho errado', () => {
    expect(validarCpf('123456789')).toBeFalse();
    expect(validarCpf('123456789099')).toBeFalse();
  });
});

describe('validarCnpj', () => {
  it('aceita um CNPJ com dígito verificador correto', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBeTrue();
    expect(validarCnpj('11222333000181')).toBeTrue();
  });

  it('rejeita dígito verificador errado', () => {
    expect(validarCnpj('11222333000180')).toBeFalse();
  });

  it('rejeita sequência repetida', () => {
    expect(validarCnpj('11111111111111')).toBeFalse();
  });

  it('rejeita tamanho errado', () => {
    expect(validarCnpj('1122233300018')).toBeFalse();
  });
});

describe('validarDocumento', () => {
  it('valida como CPF quando tem 11 dígitos', () => {
    expect(validarDocumento('123.456.789-09')).toBeTrue();
    expect(validarDocumento('123.456.789-00')).toBeFalse();
  });

  it('valida como CNPJ quando tem 14 dígitos', () => {
    expect(validarDocumento('11.222.333/0001-81')).toBeTrue();
    expect(validarDocumento('11.222.333/0001-80')).toBeFalse();
  });

  it('rejeita quantidade de dígitos que não é nem CPF nem CNPJ', () => {
    expect(validarDocumento('123')).toBeFalse();
    expect(validarDocumento('')).toBeFalse();
  });
});

describe('validarNumeroCartao', () => {
  it('aceita um número real de cartão de teste (Luhn válido)', () => {
    expect(validarNumeroCartao('4235 6477 2802 5682')).toBeTrue();
  });

  it('rejeita quando o dígito verificador (Luhn) não bate', () => {
    expect(validarNumeroCartao('4235 6477 2802 5683')).toBeFalse();
  });

  it('rejeita menos de 12 dígitos', () => {
    expect(validarNumeroCartao('4235647728')).toBeFalse();
  });

  it('rejeita mais de 19 dígitos', () => {
    expect(validarNumeroCartao('1'.repeat(20))).toBeFalse();
  });
});

describe('validarValidadeCartao', () => {
  it('aceita o mês atual — só vence no fim do mês, não no dia 1', () => {
    const agora = new Date();
    const mes = (agora.getMonth() + 1).toString().padStart(2, '0');
    const ano = (agora.getFullYear() % 100).toString().padStart(2, '0');
    expect(validarValidadeCartao(`${mes}/${ano}`)).toBeTrue();
  });

  it('aceita uma validade bem no futuro', () => {
    const anoFuturo = ((new Date().getFullYear() + 5) % 100).toString().padStart(2, '0');
    expect(validarValidadeCartao(`12/${anoFuturo}`)).toBeTrue();
  });

  it('rejeita uma validade no passado', () => {
    expect(validarValidadeCartao('01/00')).toBeFalse();
  });

  it('rejeita mês fora do intervalo 01-12', () => {
    expect(validarValidadeCartao('00/30')).toBeFalse();
    expect(validarValidadeCartao('13/30')).toBeFalse();
  });

  it('rejeita formato incompleto ou vazio', () => {
    expect(validarValidadeCartao('1/30')).toBeFalse();
    expect(validarValidadeCartao('')).toBeFalse();
  });
});
