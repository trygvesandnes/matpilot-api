/**
 * POST /api/prices-bulk
 *
 * Body (JSON):
 *   { eans: ["7038010055737", "7039010019743", ...] }  – maks 500 EANs
 *
 * Returnerer:
 *   {
 *     priser: {
 *       "7038010055737": { KIWI: 29.9, REMA_1000: 27.9, MENY: 34.9, ... },
 *       "7039010019743": { KIWI: 49.9, ... },
 *       ...
 *     }
 *   }
 *
 * Appen kan bruke dette til å erstatte den simulerte prismotoren
 * med ekte priser fra Kassalapp.
 */

import { bulkPriser } from "../../../lib/kassalapp.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body?.eans || !Array.isArray(body.eans)) {
      return Response.json(
        { error: "Body må inneholde { eans: string[] }" },
        { status: 400 }
      );
    }

    if (body.eans.length > 500) {
      return Response.json(
        { error: "Maks 500 EANs per kall" },
        { status: 400 }
      );
    }

    // Filtrer bort åpenbare ikke-EANs
    const eans = body.eans
      .map((e) => String(e).trim())
      .filter((e) => /^\d{8,14}$/.test(e));

    if (!eans.length) {
      return Response.json({ priser: {} });
    }

    const priser = await bulkPriser(eans);

    return Response.json(
      { priser },
      {
        headers: {
          // Priser caches 1 time
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[/api/prices-bulk]", err.message);
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
