/**
 * GET /api/prisfall
 * Henter billigste produkter fra Kassalapp – «Dagens beste priser».
 * Siden hobby-planen ikke har prishistorikk, viser vi de rimeligste
 * produktene per kg/liter som et nyttig alternativ.
 */

const BASE = "https://kassal.app/api/v1";

export async function GET(request) {
  try {
    const apiKey = process.env.KASSALAPP_API_KEY;
    if (!apiKey) return Response.json({ error: "API-nøkkel mangler" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const size = Math.min(parseInt(searchParams.get("size") || "40"), 100);

    // Hent produkter sortert på lavest kilopris
    const res = await fetch(
      `${BASE}/products?sort=price_asc&size=${size}`,
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

    const produkter = (data.data || [])
      .filter(p => p.current_price && p.current_price > 0)
      .map(p => ({
        ean: p.ean,
        navn: p.name,
        bilde: p.image || null,
        butikk: p.store?.name || null,
        butikkKode: p.store?.code || null,
        prisNaa: p.current_price,
        kilopris: p.current_unit_price || null,
        vekt: p.weight || null,
        vektEnhet: p.weight_unit || null,
      }));

    return Response.json(
      { prisfall: produkter, hentet: new Date().toISOString() },
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
