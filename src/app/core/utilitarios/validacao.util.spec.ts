import { validarCnpj, validarCpf, validarDocumento } from './validacao.util';

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
