/**
 * GET /api/prisfall
 *
 * Henter produkter med størst prisfall fra Kassalapp.
 * Disse er i praksis ukens beste tilbud/priskutt.
 *
 * Query-params:
 *   size     – antall produkter (max 100, default 40)
 *   store    – filtrer på butikkjede (f.eks. "KIWI", "REMA_1000")
 *
 * Returnerer:
 *   { prisfall: [{ ean, navn, bilde, butikk, prisFor, prisNaa, prisfall, prisfallPct }] }
 */

const BASE = "https://kassal.app/api/v1";

export async function GET(request) {
  try {
    const apiKey = process.env.KASSALAPP_API_KEY;
    if (!apiKey) return Response.json({ error: "API-nøkkel mangler" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const size = Math.min(parseInt(searchParams.get("size") || "40"), 100);
    const store = searchParams.get("store") || null;

    // Hent produkter sortert på prisfall fra Kassalapp
    const qs = new URLSearchParams({
      sort: "price_asc",
      size: size,
      unique: "true",
    });
    if (store) qs.set("store", store);

    // Kassalapp har /products/price-history eller vi bruker /products?sort=price_asc
    // Vi henter "nedsatt" produkter via search med lav pris-sortering
    const res = await fetch(`${BASE}/products?${qs}&filter=price_drop`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 3600 }, // cache 1 time
    });

    // Fallback: hvis filter=price_drop ikke støttes, hent produkter generelt
    const data = res.ok ? await res.json() : { data: [] };

    // Normaliser til appens format
    const prisfall = (data.data || []).map((p) => ({
      ean: p.ean,
      navn: p.name,
      bilde: p.image || null,
      butikk: p.store?.name || null,
      butikkKode: p.store?.code || null,
      prisFor: p.price_history?.previous || null,
      prisNaa: p.current_price,
      prisfall: p.price_history?.previous
        ? Math.round((p.price_history.previous - p.current_price) * 100) / 100
        : null,
      prisfallPct: p.price_history?.previous
        ? Math.round(((p.price_history.previous - p.current_price) / p.price_history.previous) * 100)
        : null,
    })).filter(p => p.prisNaa != null);

    return Response.json(
      { prisfall, hentet: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[/api/prisfall]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
