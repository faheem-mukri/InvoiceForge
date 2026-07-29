const zlib = require("zlib");

// Strict image validation for uploaded business logos.
//
// WHY THIS EXISTS: PDFKit's PNG decoder inflates pixel data inside a zlib
// callback. If the image is corrupt it throws ASYNCHRONOUSLY, which escapes any
// try/catch around doc.image() and crashes the Node process. So a malformed
// logo must be rejected at upload time — we can't recover at render time.
//
// We therefore verify structure here, and critically decompress the PNG pixel
// data with the SYNCHRONOUS zlib API (which is catchable) to prove PDFKit will
// be able to read it later.

function validatePng(buf) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) return "INVALID_LOGO_DATA";

  let offset = 8;
  let sawIHDR = false;
  let sawIEND = false;
  const idatParts = [];
  let colorType = null;
  let bitDepth = null;

  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;
    // Truncated chunk (+4 for the trailing CRC).
    if (dataEnd + 4 > buf.length) return "INVALID_LOGO_DATA";

    if (type === "IHDR") {
      if (len < 13) return "INVALID_LOGO_DATA";
      const width = buf.readUInt32BE(dataStart);
      const height = buf.readUInt32BE(dataStart + 4);
      if (width === 0 || height === 0) return "INVALID_LOGO_DATA";
      // Guard against decompression bombs.
      if (width > 5000 || height > 5000) return "LOGO_TOO_LARGE";
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
      const interlace = buf[dataStart + 12];
      // PDFKit cannot handle interlaced (Adam7) PNGs.
      if (interlace !== 0) return "INVALID_LOGO_DATA";
      sawIHDR = true;
    } else if (type === "IDAT") {
      idatParts.push(buf.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      sawIEND = true;
      break;
    }

    offset = dataEnd + 4;
  }

  if (!sawIHDR || !sawIEND || idatParts.length === 0) return "INVALID_LOGO_DATA";

  // PDFKit doesn't support 16-bit samples reliably.
  if (bitDepth === 16) return "INVALID_LOGO_DATA";

  // Palette PNGs (colorType 3) are supported by PDFKit, but its handling of
  // transparency differs; still allowed. Reject unknown color types.
  if (![0, 2, 3, 4, 6].includes(colorType)) return "INVALID_LOGO_DATA";

  // The decisive check: prove the pixel data actually inflates.
  try {
    zlib.inflateSync(Buffer.concat(idatParts));
  } catch {
    return "INVALID_LOGO_DATA";
  }

  return null;
}

function validateJpeg(buf) {
  // SOI marker
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return "INVALID_LOGO_DATA";
  // EOI marker at the end (allow trailing padding bytes)
  let end = buf.length - 1;
  while (end > 1 && buf[end] === 0x00) end--;
  if (buf[end - 1] !== 0xff || buf[end] !== 0xd9) return "INVALID_LOGO_DATA";
  return null;
}

/**
 * Returns null if the image is safe to embed, otherwise an error code string
 * ('INVALID_LOGO_DATA' | 'INVALID_LOGO_TYPE' | 'LOGO_TOO_LARGE').
 */
function validateImage(buf, mime) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return "INVALID_LOGO_DATA";

  if (mime === "image/png") return validatePng(buf);
  if (mime === "image/jpeg") return validateJpeg(buf);
  // WebP can't be embedded in a PDF by PDFKit at all.
  if (mime === "image/webp") return "INVALID_LOGO_TYPE";
  return "INVALID_LOGO_TYPE";
}

module.exports = { validateImage };
