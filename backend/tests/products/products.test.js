import { describe, it, expect, vi } from 'vitest';
import { client, registerUser } from '../helpers/api.js';
import { fakeProduct } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

// External services are mocked here rather than in a setup file: vi.mock() is
// hoisted to the top of the file it appears in, so it must be declared per test
// file to apply to this module graph.
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));


const createProduct = async (agent, overrides) => {
  const res = await agent.post('/products').send(fakeProduct(overrides));
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('POST /products', () => {
  it('creates a catalog item', async () => {
    // Arrange
    const { agent } = await registerUser();

    // Act
    const res = await agent.post('/products').send(fakeProduct({ name: 'Website Audit' }));

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Website Audit');
    expect(res.body.data.unit_price).toBe(250000);
  });

  it('stores the price in minor units exactly as supplied', async () => {
    const { agent } = await registerUser();

    const product = await createProduct(agent, { unitPrice: 199 });

    expect(product.unit_price).toBe(199);
  });

  it('defaults to a SERVICE when the type is unrecognised', async () => {
    const { agent } = await registerUser();

    const product = await createProduct(agent, { type: 'NONSENSE' });

    expect(product.type).toBe('SERVICE');
  });

  it('rejects a missing name with 422', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/products').send(fakeProduct({ name: '' }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a negative price', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/products').send(fakeProduct({ unitPrice: -100 }));

    expect(res.status).toBe(422);
  });

  it('rejects a negative tax rate', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/products').send(fakeProduct({ taxRate: -5 }));

    expect(res.status).toBe(422);
  });

  it('accepts a zero price for a free item', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/products').send(fakeProduct({ unitPrice: 0 }));

    expect(res.status).toBe(201);
  });

  it('scopes the product to its owner', async () => {
    const { agent, userId } = await registerUser();

    const product = await createProduct(agent);

    const { rows } = await getPool().query('SELECT user_id FROM products WHERE id = $1', [
      product.id,
    ]);
    expect(rows[0].user_id).toBe(userId);
  });

  it('requires authentication', async () => {
    const res = await client().post('/products').send(fakeProduct());

    expect(res.status).toBe(401);
  });
});

describe('GET /products', () => {
  it('lists only the requesting user\'s products', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    await createProduct(userA.agent);
    await createProduct(userB.agent);

    const res = await userA.agent.get('/products');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('sorts alphabetically by name for a predictable picker', async () => {
    const { agent } = await registerUser();
    await createProduct(agent, { name: 'Zebra Service' });
    await createProduct(agent, { name: 'Alpha Service' });

    const res = await agent.get('/products');

    expect(res.body.data[0].name).toBe('Alpha Service');
  });

  it('searches by name', async () => {
    const { agent } = await registerUser();
    await createProduct(agent, { name: 'Findable Widget' });
    await createProduct(agent, { name: 'Other Thing' });

    const res = await agent.get('/products?q=Findable');

    expect(res.body.data).toHaveLength(1);
  });

  it('searches by SKU', async () => {
    const { agent } = await registerUser();
    await createProduct(agent, { sku: 'UNIQUESKU1' });

    const res = await agent.get('/products?q=UNIQUESKU1');

    expect(res.body.data).toHaveLength(1);
  });

  it('filters out inactive products when asked', async () => {
    // The invoice editor only offers active items.
    const { agent } = await registerUser();
    await createProduct(agent, { name: 'Active One', isActive: true });
    await createProduct(agent, { name: 'Retired One', isActive: false });

    const res = await agent.get('/products?activeOnly=true');

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Active One');
  });

  it('includes inactive products by default', async () => {
    const { agent } = await registerUser();
    await createProduct(agent, { isActive: false });

    const res = await agent.get('/products');

    expect(res.body.data).toHaveLength(1);
  });
});

describe('PUT /products/:id', () => {
  it('updates a product', async () => {
    const { agent } = await registerUser();
    const product = await createProduct(agent);

    const res = await agent
      .put(`/products/${product.id}`)
      .send({ name: 'Renamed', unitPrice: 500000 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
    expect(res.body.data.unit_price).toBe(500000);
  });

  it('leaves unspecified fields unchanged', async () => {
    const { agent } = await registerUser();
    const product = await createProduct(agent, { name: 'Original', unit: 'hrs' });

    const res = await agent.put(`/products/${product.id}`).send({ name: 'New Name' });

    expect(res.body.data.unit).toBe('hrs');
  });

  it('can deactivate a product', async () => {
    const { agent } = await registerUser();
    const product = await createProduct(agent);

    const res = await agent.put(`/products/${product.id}`).send({ isActive: false });

    expect(res.body.data.is_active).toBe(false);
  });

  it('cannot update another user\'s product', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const product = await createProduct(owner.agent, { name: 'Protected' });

    const res = await attacker.agent.put(`/products/${product.id}`).send({ name: 'Hacked' });

    expect(res.status).toBe(404);
    const { rows } = await getPool().query('SELECT name FROM products WHERE id = $1', [product.id]);
    expect(rows[0].name).toBe('Protected');
  });

  it('returns 404 for an unknown id', async () => {
    const { agent } = await registerUser();

    const res = await agent
      .put('/products/00000000-0000-0000-0000-000000000000')
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /products/:id', () => {
  it('soft-deletes so historical invoices keep their meaning', async () => {
    const { agent } = await registerUser();
    const product = await createProduct(agent);

    const res = await agent.delete(`/products/${product.id}`);

    expect(res.status).toBe(200);

    // Hidden from the API...
    expect((await agent.get(`/products/${product.id}`)).status).toBe(404);
    // ...but the row is retained with a deletion timestamp.
    const { rows } = await getPool().query('SELECT deleted_at FROM products WHERE id = $1', [
      product.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).toBeInstanceOf(Date);
  });

  it('excludes deleted products from the list', async () => {
    const { agent } = await registerUser();
    const product = await createProduct(agent);
    await agent.delete(`/products/${product.id}`);

    const res = await agent.get('/products');

    expect(res.body.data).toEqual([]);
  });

  it('returns 404 on a second delete', async () => {
    const { agent } = await registerUser();
    const product = await createProduct(agent);
    await agent.delete(`/products/${product.id}`);

    const res = await agent.delete(`/products/${product.id}`);

    expect(res.status).toBe(404);
  });

  it('cannot delete another user\'s product', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const product = await createProduct(owner.agent);

    const res = await attacker.agent.delete(`/products/${product.id}`);

    expect(res.status).toBe(404);
  });
});
