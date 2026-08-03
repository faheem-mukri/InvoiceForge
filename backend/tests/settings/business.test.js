import { describe, it, expect } from 'vitest';
import { client, registerUser } from '../helpers/api.js';
import { fakeBusiness, fakePaymentSettings, validPngBuffer } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

describe('GET /business', () => {
  it('returns the profile provisioned at registration', async () => {
    const { agent, credentials } = await registerUser();

    const res = await agent.get('/business');

    expect(res.status).toBe(200);
    expect(res.body.data.business_email).toBe(credentials.email.toLowerCase());
  });

  it('requires authentication', async () => {
    const res = await client().get('/business');

    expect(res.status).toBe(401);
  });
});

describe('PUT /business', () => {
  it('updates business information', async () => {
    // Arrange
    const { agent } = await registerUser();
    const payload = fakeBusiness({ business_name: 'Priya Bakery' });

    // Act
    const res = await agent.put('/business').send(payload);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.business_name).toBe('Priya Bakery');
  });

  it('persists the change', async () => {
    const { agent, userId } = await registerUser();

    await agent.put('/business').send({ business_name: 'Persisted Co' });

    const { rows } = await getPool().query(
      'SELECT business_name FROM business_profiles WHERE user_id = $1',
      [userId]
    );
    expect(rows[0].business_name).toBe('Persisted Co');
  });

  it('applies a partial update without clearing other fields', async () => {
    const { agent } = await registerUser();
    await agent.put('/business').send({ business_name: 'Keep Me', gst_number: 'GST123' });

    await agent.put('/business').send({ business_phone: '+91 22222 22222' });

    const res = await agent.get('/business');
    expect(res.body.data.business_name).toBe('Keep Me');
    expect(res.body.data.gst_number).toBe('GST123');
    expect(res.body.data.business_phone).toBe('+91 22222 22222');
  });

  it('ignores unknown fields instead of failing', async () => {
    const { agent } = await registerUser();

    const res = await agent
      .put('/business')
      .send({ business_name: 'Safe Co', not_a_column: 'DROP TABLE users' });

    expect(res.status).toBe(200);
    expect(res.body.data.business_name).toBe('Safe Co');
  });

  it('cannot change another user\'s profile', async () => {
    const userA = await registerUser();
    const userB = await registerUser();

    await userB.agent.put('/business').send({ business_name: 'B Only' });

    const resA = await userA.agent.get('/business');
    expect(resA.body.data.business_name).not.toBe('B Only');
  });

  it('sets the invoice numbering prefix used for new invoices', async () => {
    const { agent } = await registerUser();
    await agent.put('/business').send({ invoice_prefix: 'ACME' });

    const invoice = await agent.post('/invoices').send({
      type: 'SERVICE',
      client_name: 'Acme',
      currency: 'INR',
      items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
    });

    expect(invoice.body.data.invoiceNumber).toMatch(/^ACME/);
  });

  it('sets the default currency', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/business').send({ default_currency: 'EUR' });

    expect(res.body.data.default_currency).toBe('EUR');
  });
});

describe('business logo', () => {
  it('accepts a valid PNG', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/business').send({
      logo_data: validPngBuffer().toString('base64'),
      logo_mime: 'image/png',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.logo_data).toBeTruthy();
  });

  it('accepts a data-URL prefixed payload', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/business').send({
      logo_data: `data:image/png;base64,${validPngBuffer().toString('base64')}`,
      logo_mime: 'image/png',
    });

    expect(res.status).toBe(200);
  });

  it('rejects a corrupt image with 422 rather than crashing later', async () => {
    // A corrupt PNG reaching PDFKit throws from a zlib callback and takes down
    // the process, so it must be refused at upload.
    const { agent } = await registerUser();

    const res = await agent.put('/business').send({
      logo_data: Buffer.from('not really a png').toString('base64'),
      logo_mime: 'image/png',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_LOGO_DATA');
  });

  it('rejects WebP, which cannot be embedded in a PDF', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/business').send({
      logo_data: validPngBuffer().toString('base64'),
      logo_mime: 'image/webp',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_LOGO_TYPE');
  });

  it('rejects an oversized logo', async () => {
    const { agent } = await registerUser();
    const tooBig = Buffer.alloc(600 * 1024, 1).toString('base64');

    const res = await agent.put('/business').send({ logo_data: tooBig, logo_mime: 'image/png' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LOGO_TOO_LARGE');
  });

  it('removes the logo when sent an empty value', async () => {
    const { agent } = await registerUser();
    await agent.put('/business').send({
      logo_data: validPngBuffer().toString('base64'),
      logo_mime: 'image/png',
    });

    const res = await agent.put('/business').send({ logo_data: null, logo_mime: null });

    expect(res.status).toBe(200);
    expect(res.body.data.logo_data).toBeNull();
  });

  it('includes the logo in the data used to render a PDF', async () => {
    // Regression: the PDF query omitted the logo columns, so the logo never
    // appeared on a generated invoice.
    const { agent } = await registerUser();
    await agent.put('/business').send({
      logo_data: validPngBuffer().toString('base64'),
      logo_mime: 'image/png',
    });
    const created = await agent.post('/invoices').send({
      type: 'SERVICE',
      client_name: 'Acme',
      currency: 'INR',
      items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
    });
    const invoiceId = created.body.data.invoiceId;
    await agent.post(`/invoices/${invoiceId}/send`);

    const res = await agent.get(`/invoices/${invoiceId}`);

    expect(res.body.data.business.logo_data).toBeTruthy();
  });
});

describe('payment settings', () => {
  it('returns settings provisioned at registration', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/payment-settings');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('cash_enabled');
  });

  it('updates enabled methods and bank details', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/payment-settings').send(fakePaymentSettings());

    expect(res.status).toBe(200);
    expect(res.body.data.upi_enabled).toBe(true);
    expect(res.body.data.upi_id).toBe('priya@upi');
  });

  it('can disable a method', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/payment-settings').send({ cash_enabled: false });

    expect(res.body.data.cash_enabled).toBe(false);
  });

  it('reports Stripe as not connected before onboarding', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/payment-settings');

    expect(res.body.data.stripe_connection_status).not.toBe('CONNECTED');
  });

  it('keeps each user\'s settings separate', async () => {
    const userA = await registerUser();
    const userB = await registerUser();

    await userB.agent.put('/payment-settings').send({ upi_id: 'userb@upi' });

    const resA = await userA.agent.get('/payment-settings');
    expect(resA.body.data.upi_id).not.toBe('userb@upi');
  });

  it('requires authentication', async () => {
    const res = await client().get('/payment-settings');

    expect(res.status).toBe(401);
  });
});
