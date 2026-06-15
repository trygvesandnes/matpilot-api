/**
 * GET /api/prisfall
 *
 * Henter produkter med størst prisfall fra Kassalapp.
 * Bruker /products?sort=price_asc kombinert med prishistorikk.
 *
 * Query-params:
 *   size  – antall produkter (max 100, default 40)
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

    // Hent produkter sortert på lavest pris – disse er ofte på tilbud
    const res = await fetch(
      `${BASE}/products?sort=price_asc&size=${size}&unique=true`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return Response.json({ error: `Kassalapp ${res.status}: ${txt.slice(0,200)}` }, { status: 502 });
    }

    const data = await res.json();

    const prisfall = (data.data || [])
      .map((p) => {
        // Finn prishistorikk hvis tilgjengelig
        const history = p.price_history || p.priceHistory || null;
        const prisFor = history?.highest_price || history?.previous || null;
        const prisNaa = p.current_price ?? null;
        const fall = prisFor && prisNaa ? Math.round((prisFor - prisNaa) * 100) / 100 : null;
        const fallPct = prisFor && prisNaa && prisFor > 0
          ? Math.round(((prisFor - prisNaa) / prisFor) * 100)
          : null;

        return {
          ean: p.ean,
          navn: p.name,
          bilde: p.image || null,
          butikk: p.store?.name || null,
          butikkKode: p.store?.code || null,
          prisFor: prisFor,
          prisNaa: prisNaa,
          prisfall: fall,
          prisfallPct: fallPct,
        };
      })
      .filter((p) => p.prisNaa != null);

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
