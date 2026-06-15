/**
 * GET /api/prisfall
 * Henter produkter med prisfall fra Kassalapp ved å sammenligne prishistorikk.
 */

const BASE = "https://kassal.app/api/v1";

export async function GET(request) {
  try {
    const apiKey = process.env.KASSALAPP_API_KEY;
    if (!apiKey) return Response.json({ error: "API-nøkkel mangler" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const size = Math.min(parseInt(searchParams.get("size") || "100"), 100);

    // Hent nyeste produkter – de har oftest oppdatert prishistorikk
    const res = await fetch(
      `${BASE}/products?sort=date_desc&size=${size}`,
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

    // Finn produkter der prisen har falt sammenlignet med tidligere pris
    const prisfall = (data.data || [])
      .map((p) => {
        const history = p.price_history || [];
        const prisNaa = p.current_price ?? null;
        if (!prisNaa || history.length < 2) return null;

        // Finn høyeste tidligere pris (ikke dagens)
        const tidligerePriser = history.slice(1).map(h => h.price).filter(Boolean);
        if (!tidligerePriser.length) return null;
        const prisFor = Math.max(...tidligerePriser);

        // Kun vis hvis prisen faktisk har falt
        if (prisFor <= prisNaa) return null;

        const fall = Math.round((prisFor - prisNaa) * 100) / 100;
        const fallPct = Math.round((fall / prisFor) * 100);

        // Kun vis meningsfylte prisfall (minst 5%)
        if (fallPct < 5) return null;

        return {
          ean: p.ean,
          navn: p.name,
          bilde: p.image || null,
          butikk: p.store?.name || null,
          butikkKode: p.store?.code || null,
          prisFor,
          prisNaa,
          prisfall: fall,
          prisfallPct: fallPct,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.prisfallPct - a.prisfallPct)
      .slice(0, 20);

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
