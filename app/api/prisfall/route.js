/**
 * GET /api/prisfall
 * Henter produkter fra Kassalapp – «Dagens beste priser».
 */

const BASE = "https://kassal.app/api/v1";

export async function GET(request) {
  try {
    const apiKey = process.env.KASSALAPP_API_KEY;
    if (!apiKey) return Response.json({ error: "API-nøkkel mangler" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const size = Math.min(parseInt(searchParams.get("size") || "20"), 100);

    const res = await fetch(
      `${BASE}/products?search=melk&size=${size}`,
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
    const antall = data.data?.length || 0;

    const prisfall = (data.data || [])
      .filter(p => p.current_price && p.current_price > 0)
      .map(p => ({
        ean: p.ean,
        navn: p.name,
        bilde: p.image || null,
        butikk: p.store?.name || null,
        butikkKode: p.store?.code || null,
        prisNaa: p.current_price,
        kilopris: p.current_unit_price || null,
        vektEnhet: p.weight_unit || null,
      }));

    return Response.json(
      { prisfall, antall, hentet: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
