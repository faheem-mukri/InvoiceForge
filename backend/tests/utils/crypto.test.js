import { describe, it, expect } from 'vitest';
import cryptoModule from '../../src/utils/crypto.js';

const { encrypt, decrypt } = cryptoModule;

/**
 * These cover secrets at rest — currently TOTP 2FA secrets. A silent failure
 * here would either lock every 2FA user out of their account or store their
 * secret in the clear, so the round trip and the tamper detection both matter.
 */
describe('encrypt / decrypt', () => {
  it('round-trips a value', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('does not store the plaintext', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    const encrypted = encrypt(secret);

    expect(encrypted).not.toContain(secret);
  });

  it('tags the ciphertext with a version so the format can change later', () => {
    expect(encrypt('value')).toMatch(/^enc:v1:/);
  });

  it('produces different ciphertext each time, because the IV is random', () => {
    // Deterministic output would leak that two users share a secret.
    const a = encrypt('same-value');
    const b = encrypt('same-value');

    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it.each([
    ['unicode', 'sécrét-ключ-🔐'],
    ['long', 'x'.repeat(5000)],
    ['whitespace', '  padded  '],
    ['empty string', ''],
  ])('round-trips %s content', (_label, value) => {
    expect(decrypt(encrypt(value))).toBe(value);
  });

  it.each([null, undefined])('passes %s through untouched', (value) => {
    expect(encrypt(value)).toBe(value);
  });

  it('coerces a non-string before encrypting', () => {
    expect(decrypt(encrypt(12345))).toBe('12345');
  });

  describe('tamper detection', () => {
    it('returns null when the ciphertext is altered', () => {
      // GCM authenticates the payload, so a modified secret must not decrypt.
      const encrypted = encrypt('JBSWY3DPEHPK3PXP');
      const parts = encrypted.slice('enc:v1:'.length).split(':');
      const ct = Buffer.from(parts[2], 'base64');
      ct[0] ^= 0xff;
      const tampered = `enc:v1:${parts[0]}:${parts[1]}:${ct.toString('base64')}`;

      expect(decrypt(tampered)).toBeNull();
    });

    it('returns null when the auth tag is altered', () => {
      const encrypted = encrypt('JBSWY3DPEHPK3PXP');
      const parts = encrypted.slice('enc:v1:'.length).split(':');
      const tag = Buffer.from(parts[1], 'base64');
      tag[0] ^= 0xff;
      const tampered = `enc:v1:${parts[0]}:${tag.toString('base64')}:${parts[2]}`;

      expect(decrypt(tampered)).toBeNull();
    });

    it('returns null for a malformed payload rather than throwing', () => {
      expect(decrypt('enc:v1:not-valid')).toBeNull();
    });
  });

  describe('backwards compatibility', () => {
    it('returns an unprefixed value as-is, so pre-encryption rows still work', () => {
      // Secrets stored before encryption was added are plaintext.
      expect(decrypt('LEGACY-PLAINTEXT-SECRET')).toBe('LEGACY-PLAINTEXT-SECRET');
    });

    it.each([null, undefined, 42, {}])('returns the non-string %s unchanged', (value) => {
      expect(decrypt(value)).toBe(value);
    });
  });
});
