/**
 * Reusable test data factories.
 *
 * Every factory takes overrides so a test states only what it cares about.
 * Values are unique per call, keeping tests independent and free of
 * unique-constraint collisions regardless of execution order.
 */
import zlib from 'node:zlib';

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(++seq).toString(36)}`;

export const VALID_PASSWORD = 'CorrectHorse123';

export function fakeUser(overrides = {}) {
  return {
    email: `user-${uniq()}@example.test`,
    password: VALID_PASSWORD,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

export function fakeBusiness(overrides = {}) {
  return {
    business_name: 'Priya Bakery',
    business_email: `biz-${uniq()}@example.test`,
    business_phone: '+91 90000 00000',
    business_address: '12 Baker Street\nMumbai',
    website: 'https://example.test',
    gst_number: '27AAAAA0000A1Z5',
    tax_id: 'TAX-1234',
    ...overrides,
  };
}

export function fakeClient(overrides = {}) {
  return {
    client_name: `Acme ${uniq()}`,
    company_name: 'Acme Ltd',
    email: `client-${uniq()}@example.test`,
    phone: '+91 98765 43210',
    billing_address: '1 Client Road',
    shipping_address: '1 Client Road',
    notes: 'Prefers email contact',
    ...overrides,
  };
}

/** A single valid line item: 2 x 2500.00 = 5000.00 */
export function fakeItem(overrides = {}) {
  return {
    description: 'Consulting',
    quantity: 2,
    unit: 'hrs',
    unit_price: 250000,
    ...overrides,
  };
}

/**
 * Invoice payload for POST /invoices. The API uses snake_case, and money is in
 * minor units (cents).
 */
export function fakeInvoice(overrides = {}) {
  return {
    type: 'SERVICE',
    client_name: 'Acme Ltd',
    client_email: `client-${uniq()}@example.test`,
    currency: 'INR',
    issue_date: '2026-01-01',
    due_date: '2026-01-15',
    items: [fakeItem()],
    ...overrides,
  };
}

/** Products API uses camelCase. */
export function fakeProduct(overrides = {}) {
  return {
    name: `Service ${uniq()}`,
    description: 'Hourly consulting',
    sku: `SKU-${uniq()}`,
    type: 'SERVICE',
    unit: 'hrs',
    unitPrice: 250000,
    currency: 'INR',
    taxRate: 18,
    isActive: true,
    ...overrides,
  };
}

export function fakePaymentSettings(overrides = {}) {
  return {
    cash_enabled: true,
    bank_transfer_enabled: true,
    upi_enabled: true,
    bank_name: 'Test Bank',
    account_holder_name: 'Priya Bakery',
    account_number: '000111222333',
    ifsc_swift_code: 'TEST0001234',
    upi_id: 'priya@upi',
    ...overrides,
  };
}

/**
 * A structurally valid 1x1 PNG, built at runtime so it is genuinely decodable.
 * Validity matters here: a corrupt PNG would crash the PDF renderer, which is
 * exactly what the logo validation tests guard against.
 */
export function validPngBuffer() {
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

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const idat = zlib.deflateSync(Buffer.from([0, 255, 0, 0])); // filter byte + RGB

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
