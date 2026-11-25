import { cleanName, optionalJersey, requireColor, requireName, requireShortName, shortNameFrom, ValidationError } from '../validation';

describe('input validation', () => {
  it('cleans and validates names', () => {
    expect(cleanName('  Lahore   Lions ')).toBe('Lahore Lions');
    expect(requireName('teamName', ' Ok ')).toBe('Ok');
    expect(() => requireName('teamName', 'A')).toThrow(ValidationError);
    expect(() => requireName('teamName', 'x'.repeat(50), { max: 40 })).toThrow(/40 characters/);
  });

  it('derives and validates short names', () => {
    expect(shortNameFrom('Lahore Lions')).toBe('LL');
    expect(shortNameFrom('Karachi Kings Club United')).toBe('KKC');
    expect(shortNameFrom('Tigers')).toBe('TIG');
    expect(requireShortName('ab1')).toBe('AB1');
    expect(() => requireShortName('A')).toThrow();
    expect(() => requireShortName('ABCDE')).toThrow();
  });

  it('validates colours and jersey numbers', () => {
    expect(requireColor('#38bdf8')).toBe('#38BDF8');
    expect(() => requireColor('blue')).toThrow();
    expect(optionalJersey(null)).toBeNull();
    expect(optionalJersey(Number.NaN)).toBeNull();
    expect(optionalJersey(7)).toBe(7);
    expect(() => optionalJersey(-1)).toThrow();
    expect(() => optionalJersey(1.5)).toThrow();
  });
});
