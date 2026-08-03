import { describe, it, expect } from 'vitest';
import validateModule from '../../src/utils/validate.js';

const { isValidEmail, normalizeEmail, validatePassword, MIN_PASSWORD_LENGTH } = validateModule;

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'first.last@example.co.uk',
    'user+tag@example.com',
    'user_name@sub.example.org',
    "o'brien@example.com",
  ])('accepts a valid address (%s)', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['no @', 'userexample.com'],
    ['no local part', '@example.com'],
    ['no domain', 'user@'],
    ['no TLD', 'user@example'],
    ['space in local part', 'user name@example.com'],
    ['space in domain', 'user@exa mple.com'],
    ['two @ signs', 'user@@example.com'],
    ['leading dot in domain', 'user@.example.com'],
    ['trailing dot', 'user@example.'],
  ])('rejects an invalid address (%s)', (_label, email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it.each([null, undefined, 123, {}, []])('rejects the non-string %s', (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it('rejects an address longer than 254 characters', () => {
    const long = `${'a'.repeat(250)}@example.com`;

    expect(isValidEmail(long)).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail('User@Example.com');

    expect(normalizeEmail(once)).toBe(once);
  });

  it.each([null, undefined])('returns an empty string for %s', (value) => {
    expect(normalizeEmail(value)).toBe('');
  });

  it('makes two differently-cased addresses compare equal', () => {
    // This is the property that stops one person creating two accounts.
    expect(normalizeEmail('Priya@Mail.com')).toBe(normalizeEmail('priya@mail.com'));
  });
});

describe('isUuid', () => {
  // Route params reach uuid-typed queries directly, so an unparseable value
  // would make Postgres raise 22P02 and surface as a 500.
  it.each([
    '550e8400-e29b-41d4-a716-446655440000',
    '00000000-0000-0000-0000-000000000000',
    '6EB41492-E4C2-4346-B53D-B03B19ACC77C', // uppercase
  ])('accepts the valid uuid %s', (value) => {
    expect(validateModule.isUuid(value)).toBe(true);
  });

  it.each([
    ['plain text', 'not-a-uuid'],
    ['empty', ''],
    ['too short', '550e8400-e29b-41d4-a716'],
    ['no hyphens', '550e8400e29b41d4a716446655440000'],
    ['non-hex characters', '550e8400-e29b-41d4-a716-44665544zzzz'],
    ['SQL fragment', "' OR 1=1--"],
  ])('rejects %s', (_label, value) => {
    expect(validateModule.isUuid(value)).toBe(false);
  });

  it.each([null, undefined, 123, {}, []])('rejects the non-string %s', (value) => {
    expect(validateModule.isUuid(value)).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(validateModule.isUuid('  550e8400-e29b-41d4-a716-446655440000  ')).toBe(true);
  });
});

describe('validatePassword', () => {
  it('accepts a reasonable password', () => {
    expect(validatePassword('CorrectHorse123')).toBeNull();
  });

  it('accepts a password with symbols', () => {
    expect(validatePassword('p@ssw0rd!x')).toBeNull();
  });

  it('rejects an empty password', () => {
    expect(validatePassword('')).toMatch(/required/i);
  });

  it.each([null, undefined, 12345678])('rejects the non-string %s', (value) => {
    expect(validatePassword(value)).toBeTruthy();
  });

  it(`rejects a password shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(validatePassword('Ab3')).toMatch(/at least/i);
  });

  it('accepts a password exactly at the minimum length', () => {
    expect(validatePassword('Abcdef12')).toBeNull();
  });

  it('rejects digits only, however long', () => {
    expect(validatePassword('1234567890123')).toMatch(/only numbers/i);
  });

  it('rejects letters only, however long', () => {
    expect(validatePassword('abcdefghijklmnop')).toMatch(/number or symbol/i);
  });

  it('rejects an absurdly long password rather than passing it to bcrypt', () => {
    expect(validatePassword(`${'a'.repeat(300)}1`)).toMatch(/at most/i);
  });

  it('returns a human-readable reason, not a code', () => {
    const reason = validatePassword('abc');

    expect(reason).toMatch(/[a-z]{3,}\s/); // contains words and spaces
    expect(reason.endsWith('.')).toBe(true);
  });
});
