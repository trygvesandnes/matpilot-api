/**
 * kassalapp.js
 * Wrapper rundt Kassalapp API v1.
 * Alle kall går gjennom denne filen – API-nøkkelen forlater aldri serveren.
 */

const BASE = "https://kassal.app/api/v1";

// Kassalapp kjede-koder → appens interne kjede-ID
export const KJEDE_MAP = {
  KIWI:          "KIWI",
  REMA_1000:     "REMA_1000",
  MENY_NO:       "MENY",
  SPAR_NO:       "SPAR",
  EUROSPAR_NO:   "EUROSPAR",
  JOKER_NO:      "JOKER",
  NAERBUTIKKEN:  "NAERBUTIKKEN",
  COOP_EXTRA:    "COOP_EXTRA",
  COOP_OBS:      "COOP_OBS",
  COOP_PRIX:     "COOP_PRIX",
  COOP_MEGA:     "COOP_MEGA",
  COOP_MARKED:   "COOP_MARKED",
  MATKROKEN:     "MATKROKEN",
  BUNNPRIS:      "BUNNPRIS",
  EUROPRIS_NO:   "EUROPRIS",
  FUDI:          "FUDI",
  HAVARISTEN:    "HAVARISTEN",
  GIGABOKS:      "GIGABOKS",
  ODA_NO:        "ODA",
};

async function kassalFetch(path, options = {}) {
  const apiKey = process.env.KASSALAPP_API_KEY;
  if (!apiKey) throw new Error("KASSALAPP_API_KEY mangler i miljøvariabler");

  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    // Next.js ISR: cache butikker i 24 t, priser i 1 t
    next: options.revalidate !== undefined ? { revalidate: options.revalidate } : undefined,
  });

  if (res.status === 429) {
    // Rate-limit: vent 2 sek og prøv én gang til
    await new Promise((r) => setTimeout(r, 2000));
    return kassalFetch(path, options);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kassalapp ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Hent fysiske butikker.
 * @param {object} params - { search?, page?, size?, lat?, lng?, km?, group? }
 */
export async function hentButikker(params = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.page)   qs.set("page",   params.page);
  if (params.size)   qs.set("size",   Math.min(params.size ?? 100, 100));
  if (params.lat)    qs.set("lat",    params.lat);
  if (params.lng)    qs.set("lng",    params.lng);
  if (params.km)     qs.set("km",     params.km);
  if (params.group)  qs.set("group",  params.group);

  const data = await kassalFetch(`/physical-stores?${qs}`, { revalidate: 86400 });

  // Normalisér til appens format
  const butikker = data.data.map((b) => ({
    id:       `kassl_${b.id}`,
    navn:     b.name,
    kjede:    KJEDE_MAP[b.group] ?? b.group,
    adresse:  b.address,
    sted:     b.address?.split(",").slice(-2, -1)[0]?.trim() ?? "",
    lat:      parseFloat(b.position?.lat),
    lng:      parseFloat(b.position?.lng),
    aapningstider: b.openingHours ?? null,
  }));

  return {
    butikker,
    meta: data.meta,   // current_page, last_page, total
  };
}

/**
 * Hent produkter med søk.
 * @param {object} params - { search?, page?, size?, brand?, category?, unique? }
 */
export async function sokProdukter(params = {}) {
  const qs = new URLSearchParams();
  if (params.search)   qs.set("search",   params.search);
  if (params.page)     qs.set("page",     params.page);
  if (params.size)     qs.set("size",     Math.min(params.size ?? 20, 100));
  if (params.brand)    qs.set("brand",    params.brand);
  if (params.category) qs.set("category", params.category);
  if (params.unique)   qs.set("unique",   "true");

  const data = await kassalFetch(`/products?${qs}`, { revalidate: 3600 });

  return {
    produkter: data.data.map(normalisertProdukt),
    meta: data.meta,
  };
}

/**
 * Bulk-pris for opptil 100 EAN-koder.
 * Returnerer { ean -> { [kjedeKode]: pris } }
 * @param {string[]} eans
 */
export async function bulkPriser(eans) {
  if (!eans?.length) return {};

  // Kassalapp maks 100 EAN per kall – del opp ved behov
  const chunks = [];
  for (let i = 0; i < eans.length; i += 100) chunks.push(eans.slice(i, i + 100));

  const results = await Promise.all(
    chunks.map((chunk) =>
      kassalFetch("/products/prices-bulk", {
        method: "POST",
        body: JSON.stringify({ eans: chunk, days: 1, aggregation: "min" }),
        revalidate: 3600,
      })
    )
  );

  const prisMap = {};
  for (const res of results) {
    for (const item of res.data ?? []) {
      prisMap[item.ean] = {};
      for (const s of item.stores ?? []) {
        const kjedeId = KJEDE_MAP[s.store] ?? s.store;
        prisMap[item.ean][kjedeId] = s.current_price;
      }
    }
  }
  return prisMap;
}

// --- Intern normalisering ---
function normalisertProdukt(p) {
  const naering = {};
  for (const n of p.nutrition ?? []) {
    if (n.code === "energi_kcal")   naering.kcal    = n.amount;
    if (n.code === "protein")        naering.protein  = n.amount;
    if (n.code === "fett_totalt")    naering.fett     = n.amount;
    if (n.code === "karbohydrater")  naering.karbo    = n.amount;
    if (n.code === "kostfiber")      naering.fiber    = n.amount;
    if (n.code === "sukkerarter")    naering.sukker   = n.amount;
  }
  return {
    kassalId:   p.id,
    ean:        p.ean,
    navn:       p.name,
    prod:       p.brand ?? p.vendor ?? "",
    bilde:      p.image ?? null,
    pris:       p.current_price,
    kjede:      KJEDE_MAP[p.store?.code] ?? p.store?.code ?? null,
    m:          Object.keys(naering).length ? naering : undefined,
  };
}
