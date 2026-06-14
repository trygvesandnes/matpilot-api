/**
 * api-klient.js
 * ─────────────────────────────────────────────────────────────
 * Importer disse tre funksjonene i matpilot.jsx og bruk dem
 * til å erstatte de simulerte dataene med ekte Kassalapp-data.
 *
 * Sett PROXY_URL til URLen der matpilot-api kjører, f.eks.:
 *   - Lokalt:     http://localhost:3000
 *   - Produksjon: https://api.matpilot.no
 * ─────────────────────────────────────────────────────────────
 */

const PROXY_URL = "http://localhost:3000"; // ← endre ved deploy

// ── 1. Hent butikker ──────────────────────────────────────────
/**
 * Last ned butikker fra proxyen.
 * Kall én gang ved app-oppstart (eller legg i useEffect).
 *
 * @param {{ lat?: number, lng?: number, km?: number }} [posisjon]
 * @returns {Promise<Array>}  Array av butikk-objekter i appens format
 */
export async function lastButikker(posisjon) {
  const qs = new URLSearchParams({ size: "100" });
  if (posisjon?.lat) { qs.set("lat", posisjon.lat); qs.set("lng", posisjon.lng); }
  if (posisjon?.km)  qs.set("km", posisjon.km);

  const res = await fetch(`${PROXY_URL}/api/stores?${qs}`);
  if (!res.ok) throw new Error("Klarte ikke laste butikker");
  const { butikker, meta } = await res.json();

  // Hvis det finnes flere sider, last alle
  if (meta.last_page > 1) {
    const resterendeSider = Array.from(
      { length: meta.last_page - 1 },
      (_, i) => i + 2
    );
    const ekstra = await Promise.all(
      resterendeSider.map(async (page) => {
        const r = await fetch(`${PROXY_URL}/api/stores?${qs}&page=${page}`);
        const d = await r.json();
        return d.butikker;
      })
    );
    return [...butikker, ...ekstra.flat()];
  }

  return butikker;
}

// ── 2. Søk etter produkter ────────────────────────────────────
/**
 * Søk i Kassalapp-produktkatalogen.
 * Bruk i søkefeltet i produktvisningen (debounce anbefalt).
 *
 * @param {string} sokeord
 * @param {{ page?: number, size?: number, unique?: boolean }} [opts]
 * @returns {Promise<{ produkter: Array, meta: object }>}
 */
export async function sokEkteProdukter(sokeord, opts = {}) {
  const qs = new URLSearchParams({
    search: sokeord,
    size:   opts.size   ?? 20,
    page:   opts.page   ?? 1,
    unique: opts.unique ?? "true",
  });
  const res = await fetch(`${PROXY_URL}/api/products?${qs}`);
  if (!res.ok) throw new Error("Produktsøk feilet");
  return res.json();
}

// ── 3. Hent ekte priser for handlekurven ─────────────────────
/**
 * Hent ekte priser for et sett med EAN-koder.
 * Kall dette når handlekurven endres (debounce 300 ms anbefalt).
 *
 * Returnerer et objekt:
 *   { "7038010055737": { KIWI: 27.9, REMA_1000: 26.9, ... }, ... }
 *
 * @param {string[]} eans  EAN-koder for varene i kurven
 * @returns {Promise<Record<string, Record<string, number>>>}
 */
export async function hentBulkPriser(eans) {
  if (!eans.length) return {};
  const res = await fetch(`${PROXY_URL}/api/prices-bulk`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ eans }),
  });
  if (!res.ok) throw new Error("Bulk-pris-kall feilet");
  const { priser } = await res.json();
  return priser;
}

// ── Brukseksempel i matpilot.jsx ──────────────────────────────
/*

// I App-komponenten:

useEffect(() => {
  lastButikker().then(setEkstraButikker).catch(console.error);
}, []);

// I handlekurven, når kurven endres:
useEffect(() => {
  const eans = Object.keys(kurv)
    .map(id => VARER.find(v => v.id === id)?.ean)
    .filter(Boolean);

  if (!eans.length) return;

  const timer = setTimeout(async () => {
    const priser = await hentBulkPriser(eans);
    // Konverter til appens adminPriser-format og kall settPrisData()
    // priser["7038..."]["KIWI"] = 27.9  →  adminPriser["pepsimax|kiwi_moholt"] = { pris: 27.9 }
  }, 300);

  return () => clearTimeout(timer);
}, [kurv]);

*/
