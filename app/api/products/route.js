/**
 * GET /api/products
 *
 * Query-params:
 *   search   – fritekstsøk (f.eks. "helmelk tine")
 *   page     – sidenummer
 *   size     – antall per side (max 100, default 20)
 *   brand    – filtrer på merke
 *   category – filtrer på kategori (delvis treff, min 3 tegn)
 *   unique   – "true" for å unngå duplikater på tvers av butikker
 *
 * Returnerer:
 *   { produkter: [...], meta: { current_page, ... } }
 */

import { sokProdukter } from "../../../lib/kassalapp.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search");
    if (!search || search.trim().length < 2) {
      return Response.json(
        { error: "Søkeordet må være minst 2 tegn" },
        { status: 400 }
      );
    }

    const params = {
      search:   search.trim(),
      page:     searchParams.get("page")     ?? 1,
      size:     searchParams.get("size")     ?? 20,
      brand:    searchParams.get("brand")    ?? undefined,
      category: searchParams.get("category") ?? undefined,
      unique:   searchParams.get("unique") === "true",
    };

    const resultat = await sokProdukter(params);

    return Response.json(resultat, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[/api/products]", err.message);
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
