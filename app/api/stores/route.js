/**
 * GET /api/stores
 *
 * Query-params:
 *   search  – tekstsøk på navn/adresse
 *   page    – sidenummer (default 1)
 *   size    – antall per side (max 100, default 100)
 *   lat     – breddegrad for nærhetssøk
 *   lng     – lengdegrad for nærhetssøk
 *   km      – radius i km (default 5)
 *   group   – kjede-kode fra Kassalapp (f.eks. KIWI, REMA_1000)
 *
 * Returnerer:
 *   { butikker: [...], meta: { current_page, last_page, total } }
 */

import { hentButikker } from "../../../lib/kassalapp.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      search: searchParams.get("search") ?? undefined,
      page:   searchParams.get("page")   ?? 1,
      size:   searchParams.get("size")   ?? 100,
      lat:    searchParams.get("lat")    ?? undefined,
      lng:    searchParams.get("lng")    ?? undefined,
      km:     searchParams.get("km")     ?? undefined,
      group:  searchParams.get("group")  ?? undefined,
    };

    const resultat = await hentButikker(params);

    return Response.json(resultat, {
      headers: {
        // Tillat frontend å cache i 24 timer
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[/api/stores]", err.message);
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
