import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import imageValidateModule from '../../src/utils/imageValidate.js';
import { validPngBuffer } from '../fixtures/index.js';

const { validateImage } = imageValidateModule;

/**
 * These tests guard a crash, not just a validation rule.
 *
 * PDFKit's PNG decoder inflates pixel data inside a zlib callback. On a corrupt
 * image it throws ASYNCHRONOUSLY, which escapes try/catch and terminates the
 * Node process. Rejecting bad images at upload time is therefore the only place
 * the failure can be contained.
 */
describe('validateImage', () => {
  describe('PNG', () => {
    it('accepts a structurally valid PNG', () => {
      expect(validateImage(validPngBuffer(), 'image/png')).toBeNull();
    });

    it('rejects a buffer that is not a PNG at all', () => {
      expect(validateImage(Buffer.from('definitely not an image'), 'image/png')).toBe(
        'INVALID_LOGO_DATA'
      );
    });

    it('rejects a PNG with a valid signature but truncated chunks', () => {
      const truncated = validPngBuffer().subarray(0, 20);

      expect(validateImage(truncated, 'image/png')).toBe('INVALID_LOGO_DATA');
    });

    it('rejects a PNG whose pixel data will not inflate', () => {
      // Signature and chunk structure are intact, but IDAT is garbage — exactly
      // the case that crashes PDFKit.
      const valid = validPngBuffer();
      const corrupted = Buffer.from(valid);
      const idatIndex = corrupted.indexOf(Buffer.from('IDAT', 'ascii'));
      corrupted[idatIndex + 4] = 0xff;
      corrupted[idatIndex + 5] = 0xff;

      expect(validateImage(corrupted, 'image/png')).toBe('INVALID_LOGO_DATA');
    });

    it('rejects a PNG with no IEND chunk', () => {
      const valid = validPngBuffer();
      const noEnd = valid.subarray(0, valid.length - 12);

      expect(validateImage(noEnd, 'image/png')).toBe('INVALID_LOGO_DATA');
    });

    it('rejects zero dimensions', () => {
      expect(validateImage(buildPng({ width: 0, height: 1 }), 'image/png')).toBe(
        'INVALID_LOGO_DATA'
      );
    });

    it('rejects absurd dimensions to avoid a decompression bomb', () => {
      expect(validateImage(buildPng({ width: 20000, height: 20000 }), 'image/png')).toBe(
        'LOGO_TOO_LARGE'
      );
    });

    it('rejects an interlaced PNG, which PDFKit cannot render', () => {
      expect(validateImage(buildPng({ interlace: 1 }), 'image/png')).toBe('INVALID_LOGO_DATA');
    });

    it('rejects 16-bit samples, which PDFKit handles unreliably', () => {
      expect(validateImage(buildPng({ bitDepth: 16 }), 'image/png')).toBe('INVALID_LOGO_DATA');
    });
  });

  describe('JPEG', () => {
    it('accepts a minimal well-formed JPEG', () => {
      const jpeg = Buffer.concat([
        Buffer.from([0xff, 0xd8]), // SOI
        Buffer.from([0xff, 0xe0, 0x00, 0x10]),
        Buffer.from('JFIF\0', 'ascii'),
        Buffer.alloc(10),
        Buffer.from([0xff, 0xd9]), // EOI
      ]);

      expect(validateImage(jpeg, 'image/jpeg')).toBeNull();
    });

    it('rejects a JPEG without the start-of-image marker', () => {
      expect(validateImage(Buffer.from([0x00, 0x01, 0xff, 0xd9]), 'image/jpeg')).toBe(
        'INVALID_LOGO_DATA'
      );
    });

    it('rejects a truncated JPEG missing its end marker', () => {
      expect(validateImage(Buffer.from([0xff, 0xd8, 0x12, 0x34]), 'image/jpeg')).toBe(
        'INVALID_LOGO_DATA'
      );
    });
  });

  describe('unsupported types', () => {
    it('rejects WebP because PDFKit cannot embed it', () => {
      // Accepting it would silently produce invoices with a missing logo.
      expect(validateImage(validPngBuffer(), 'image/webp')).toBe('INVALID_LOGO_TYPE');
    });

    it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain', ''])(
      'rejects %s',
      (mime) => {
        expect(validateImage(validPngBuffer(), mime)).toBe('INVALID_LOGO_TYPE');
      }
    );
  });

  describe('malformed input', () => {
    it('rejects an empty buffer', () => {
      expect(validateImage(Buffer.alloc(0), 'image/png')).toBe('INVALID_LOGO_DATA');
    });

    it.each([null, undefined, 'a string', 123, {}])('rejects the non-buffer %s', (value) => {
      expect(validateImage(value, 'image/png')).toBe('INVALID_LOGO_DATA');
    });
  });
});

/** Builds a PNG with specific IHDR values, for targeting individual rules. */
function buildPng({ width = 1, height = 1, bitDepth = 8, colorType = 2, interlace = 0 } = {}) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[12] = interlace;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
