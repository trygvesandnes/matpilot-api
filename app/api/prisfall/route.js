/**
 * GET /api/prisfall
 * Henter et variert utvalg produkter fra Kassalapp – «Dagens beste priser».
 */

const BASE = "https://kassal.app/api/v1";

const KATEGORIER = ["kylling", "laks", "yoghurt", "ost", "egg", "brød", "banan", "eple"];

export async function GET(request) {
  try {
    const apiKey = process.env.KASSALAPP_API_KEY;
    if (!apiKey) return Response.json({ error: "API-nøkkel mangler" }, { status: 500 });

    // Hent fra 4 tilfeldige kategorier parallelt
    const valgte = KATEGORIER.sort(() => 0.5 - Math.random()).slice(0, 4);

    const resultater = await Promise.allSettled(
      valgte.map(kategori =>
        fetch(`${BASE}/products?search=${kategori}&size=5&unique=1`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          next: { revalidate: 3600 },
        }).then(r => r.ok ? r.json() : { data: [] })
      )
    );

    const alle = resultater
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value?.data || [])
      .filter(p => p.current_price && p.current_price > 0 && p.image)
      .map(p => ({
        ean: p.ean,
        navn: p.name,
        bilde: p.image,
        butikk: p.store?.name || null,
        butikkKode: p.store?.code || null,
        prisNaa: p.current_price,
        kilopris: p.current_unit_price || null,
        vektEnhet: p.weight_unit || null,
      }));

    // Dedupliser på EAN
    const sett = new Set();
    const prisfall = alle.filter(p => {
      if(!p.ean || sett.has(p.ean)) return false;
      sett.add(p.ean);
      return true;
    }).slice(0, 20);

    return Response.json(
      { prisfall, hentet: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
