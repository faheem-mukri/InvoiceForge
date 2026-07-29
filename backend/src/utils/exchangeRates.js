// Currency conversion for dashboard aggregation. Invoices can be issued in any
// supported currency; the dashboard normalizes everything to the business's
// base currency.
//
// Rates are fetched (no API key needed) from open.er-api.com and cached in
// memory. If the network call fails, we fall back to a built-in approximate
// table so the dashboard never breaks — totals are then "approximate".
//
// All rates are expressed relative to USD: rates[CUR] = how many CUR per 1 USD.

const STATIC_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83,
  CAD: 1.36,
  AUD: 1.52,
  AED: 3.67,
  SGD: 1.35,
  JPY: 156,
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cache = { rates: null, fetchedAt: 0, live: false };

async function getRates() {
  const now = Date.now();
  if (cache.rates && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data && data.result === "success" && data.rates && data.rates.USD === 1) {
      cache = { rates: data.rates, fetchedAt: now, live: true };
      return cache;
    }
    throw new Error("Unexpected exchange-rate response");
  } catch (err) {
    console.error("Exchange-rate fetch failed, using static fallback:", err.message);
    // Cache the fallback briefly so we don't hammer the API on every request.
    cache = { rates: STATIC_RATES, fetchedAt: now - (CACHE_TTL_MS - 10 * 60 * 1000), live: false };
    return cache;
  }
}

// Convert an integer minor-unit amount (e.g. cents) from one currency to
// another. Returns the converted minor-unit integer, or null if either
// currency's rate is unknown (caller should fall back to the original value).
function convertMinor(amountMinor, from, to, rates) {
  const n = Number(amountMinor) || 0;
  if (!from || !to || from === to) return n;
  const rFrom = rates?.[from];
  const rTo = rates?.[to];
  if (!rFrom || !rTo) return null;
  const usd = n / 100 / rFrom;
  return Math.round(usd * rTo * 100);
}

module.exports = { getRates, convertMinor, STATIC_RATES };
