import {
  mascararCep,
  mascararCvv,
  mascararDocumento,
  mascararNumeroCartao,
  mascararTelefone,
  mascararValidadeCartao,
} from './mascara.util';

describe('mascararCep', () => {
  it('não formata enquanto tem 5 dígitos ou menos', () => {
    expect(mascararCep('123')).toBe('123');
    expect(mascararCep('12345')).toBe('12345');
  });

  it('insere o traço a partir do 6º dígito', () => {
    expect(mascararCep('123456')).toBe('12345-6');
    expect(mascararCep('12345678')).toBe('12345-678');
  });

  it('ignora tudo que não é dígito e trunca em 8', () => {
    expect(mascararCep('12.345-678extra')).toBe('12345-678');
  });
});

describe('mascararTelefone', () => {
  it('não formata com 2 dígitos ou menos', () => {
    expect(mascararTelefone('11')).toBe('11');
  });

  it('formata DDD + início do número (3 a 6 dígitos)', () => {
    expect(mascararTelefone('119999')).toBe('(11) 9999');
  });

  it('formata celular completo (11 dígitos, separador antes do 7º)', () => {
    expect(mascararTelefone('11999999999')).toBe('(11) 99999-9999');
  });

  it('formata fixo completo (10 dígitos, separador antes do 6º)', () => {
    expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
  });

  it('remove o código do país (55) grudado na frente quando vem autopreenchido', () => {
    expect(mascararTelefone('5511999999999')).toBe('(11) 99999-9999');
  });

  it('não mexe em número de 11 dígitos que por acaso começa com 55 (DDD 55 é válido)', () => {
    // DDD 55 é Santa Maria/RS — 11 dígitos começando com 55 é um número local válido,
    // não tem "código de país" pra remover aqui (só remove acima de 11 dígitos).
    expect(mascararTelefone('55999999999')).toBe('(55) 99999-9999');
  });

  it('trunca em 11 dígitos (depois de remover código de país, se houver)', () => {
    expect(mascararTelefone('119999999999999')).toBe('(11) 99999-9999');
  });
});

describe('mascararDocumento', () => {
  it('formata progressivamente como CPF até 11 dígitos', () => {
    expect(mascararDocumento('123')).toBe('123');
    expect(mascararDocumento('123456')).toBe('123.456');
    expect(mascararDocumento('12345678909')).toBe('123.456.789-09');
  });

  it('muda pro formato de CNPJ a partir do 12º dígito', () => {
    expect(mascararDocumento('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('trunca em 14 dígitos', () => {
    expect(mascararDocumento('112223330001819999')).toBe('11.222.333/0001-81');
  });
});

describe('mascararNumeroCartao', () => {
  it('agrupa de 4 em 4 dígitos', () => {
    expect(mascararNumeroCartao('4235647728025682')).toBe('4235 6477 2802 5682');
  });

  it('não deixa espaço sobrando no fim de um grupo incompleto', () => {
    expect(mascararNumeroCartao('42356')).toBe('4235 6');
    expect(mascararNumeroCartao('4235')).toBe('4235');
  });

  it('ignora letras e símbolos', () => {
    expect(mascararNumeroCartao('4235-6477-2802-5682')).toBe('4235 6477 2802 5682');
    expect(mascararNumeroCartao('abcd4235')).toBe('4235');
  });

  it('trunca em 19 dígitos', () => {
    expect(mascararNumeroCartao('1'.repeat(25))).toBe('1111 1111 1111 1111 111');
  });
});

describe('mascararValidadeCartao', () => {
  it('não insere barra com 2 dígitos ou menos', () => {
    expect(mascararValidadeCartao('1')).toBe('1');
    expect(mascararValidadeCartao('12')).toBe('12');
  });

  it('insere a barra a partir do 3º dígito', () => {
    expect(mascararValidadeCartao('123')).toBe('12/3');
    expect(mascararValidadeCartao('1230')).toBe('12/30');
  });

  it('trunca em 4 dígitos e ignora não-dígitos', () => {
    expect(mascararValidadeCartao('12/30/99')).toBe('12/30');
  });
});

describe('mascararCvv', () => {
  it('mantém só dígitos', () => {
    expect(mascararCvv('12a3')).toBe('123');
  });

  it('trunca em 4 dígitos', () => {
    expect(mascararCvv('123456')).toBe('1234');
  });
});
