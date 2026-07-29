/**
 * CI smoke test — boots the Express app against a real Postgres database and
 * exercises the critical paths that would otherwise only break in production:
 * register -> login -> authenticated read -> products CRUD -> invoice + PDF.
 *
 * Uses only Node built-ins (no test framework) and exits non-zero on failure.
 * Run by .github/workflows/ci.yml.
 */
const assert = require("assert");
const app = require("../src/app");
const pool = require("../src/db");

let server;
let baseUrl;
let cookie = "";

function label(name) {
  console.log(`  ok - ${name}`);
}

// Minimal fetch wrapper that carries the auth cookie between calls.
async function call(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // Capture auth cookies so subsequent requests are authenticated.
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = setCookie.map((c) => c.split(";")[0]);
    cookie = [cookie, ...jar].filter(Boolean).join("; ");
  }

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json()
    : Buffer.from(await res.arrayBuffer());

  return { status: res.status, body: payload, contentType };
}

(async () => {
  try {
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`Smoke testing ${baseUrl}`);

    // 1. Health
    const health = await call("GET", "/health");
    assert.strictEqual(health.status, 200, "health should return 200");
    label("GET /health");

    // 2. Register
    const email = `ci_${Date.now()}@example.com`;
    const password = "ci-password-123";
    const reg = await call("POST", "/auth/register", {
      email,
      password,
      firstName: "CI",
      lastName: "Bot",
    });
    assert.ok(reg.status === 200 || reg.status === 201, `register failed: ${JSON.stringify(reg.body)}`);
    label("POST /auth/register");

    // 3. Login
    const login = await call("POST", "/auth/login", { email, password });
    assert.strictEqual(login.status, 200, `login failed: ${JSON.stringify(login.body)}`);
    label("POST /auth/login");

    // 4. Authenticated read (proves cookie auth + requireAuth work)
    const me = await call("GET", "/auth/me");
    assert.strictEqual(me.status, 200, "auth/me should be 200 when logged in");
    assert.strictEqual(me.body.data.email, email, "auth/me returns the right user");
    label("GET /auth/me (cookie auth)");

    // 5. Dashboard aggregation (multi-currency code path)
    const dash = await call("GET", "/dashboard");
    assert.strictEqual(dash.status, 200, "dashboard should load");
    assert.ok(dash.body.data.revenue.currency, "dashboard reports a base currency");
    label("GET /dashboard");

    // 6. Product catalog CRUD
    const created = await call("POST", "/products", {
      name: "CI Consulting",
      type: "SERVICE",
      unit: "hrs",
      unitPrice: 250000,
      currency: "INR",
      taxRate: 18,
    });
    assert.strictEqual(created.status, 201, `product create failed: ${JSON.stringify(created.body)}`);
    const productId = created.body.data.id;
    label("POST /products");

    const listed = await call("GET", "/products");
    assert.ok(
      listed.body.data.some((p) => p.id === productId),
      "created product appears in the list"
    );
    label("GET /products");

    const renamed = await call("PUT", `/products/${productId}`, { name: "CI Consulting v2" });
    assert.strictEqual(renamed.body.data.name, "CI Consulting v2", "product updates");
    label("PUT /products/:id");

    // Validation is enforced
    const invalid = await call("POST", "/products", { name: "" });
    assert.strictEqual(invalid.status, 422, "empty product name is rejected");
    label("POST /products rejects invalid input (422)");

    // 7. Business profile + logo validation (a corrupt image must be rejected
    //    here, because it would crash the PDF renderer later).
    const badLogo = await call("PUT", "/business", {
      logo_data: "bm90LWFuLWltYWdl",
      logo_mime: "image/png",
    });
    assert.strictEqual(badLogo.status, 422, "corrupt logo is rejected");
    label("PUT /business rejects a corrupt logo (422)");

    // 8. Invoice create -> send -> PDF render (exercises PDFKit + the embedded
    //    Unicode font). PDFs are only downloadable for SENT/PAID invoices.
    const invoice = await call("POST", "/invoices", {
      type: "SERVICE",
      client_name: "CI Client",
      client_email: "ci-client@example.com",
      currency: "INR",
      items: [{ description: "Consulting", quantity: 2, unit: "hrs", unit_price: 250000 }],
    });
    assert.strictEqual(invoice.status, 201, `invoice create failed: ${JSON.stringify(invoice.body)}`);
    const invoiceId = invoice.body.data.invoiceId;
    assert.ok(invoiceId, "create returns an invoice id");
    label("POST /invoices");

    // Totals must be computed server-side from the line items (2 x 2500.00).
    const fetched = await call("GET", `/invoices/${invoiceId}`);
    assert.strictEqual(fetched.status, 200, "invoice should be readable");
    assert.strictEqual(
      Number(fetched.body.data.invoice.total_amount),
      500000,
      "server computes totals from line items"
    );
    label("GET /invoices/:id (server-side totals)");

    // Email delivery is best-effort and unconfigured in CI, so send() still
    // transitions the invoice to SENT.
    const sent = await call("POST", `/invoices/${invoiceId}/send`);
    assert.strictEqual(sent.status, 200, `invoice send failed: ${JSON.stringify(sent.body)}`);
    label("POST /invoices/:id/send");

    const pdf = await call("GET", `/invoices/${invoiceId}/pdf`);
    assert.strictEqual(pdf.status, 200, "PDF should render");
    assert.ok(pdf.body.length > 1000, "PDF has content");
    assert.strictEqual(
      pdf.body.subarray(0, 4).toString("latin1"),
      "%PDF",
      "response is a real PDF"
    );
    label("GET /invoices/:id/pdf");

    // 9. Unauthenticated access is refused
    const saved = cookie;
    cookie = "";
    const denied = await call("GET", "/invoices");
    assert.strictEqual(denied.status, 401, "protected route requires auth");
    cookie = saved;
    label("GET /invoices without auth -> 401");

    console.log("\nAll smoke tests passed.");
  } catch (err) {
    console.error("\nSMOKE TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await pool.end().catch(() => {});
  }
})();
