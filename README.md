# Matpilot API-proxy

En minimal Next.js-backend som lar Matpilot-appen hente ekte priser og butikker
fra Kassalapp API uten å eksponere API-nøkkelen i frontend-koden.

---

## Arkitektur

```
Matpilot-app (React/artifact)
        │
        │  fetch() til din proxy
        ▼
┌─────────────────────────┐
│  matpilot-api (Next.js) │  ← denne mappen
│  /api/stores            │
│  /api/products          │
│  /api/prices-bulk       │
└──────────┬──────────────┘
           │  Bearer KASSALAPP_API_KEY
           ▼
   kassal.app/api/v1
```

API-nøkkelen forlater aldri serveren. Appen snakker kun med proxyen.

---

## Kom i gang (lokalt)

### 1. Forutsetninger
- Node.js 18 eller nyere
- En gratis Kassalapp-konto: https://kassal.app/register
- Kassalapp API-nøkkel: https://kassal.app/profil/api

### 2. Installer
```bash
cd matpilot-api
npm install
```

### 3. Miljøvariabler
```bash
cp .env.example .env.local
# Rediger .env.local og lim inn API-nøkkelen din
```

### 4. Start utviklingsserver
```bash
npm run dev
# Kjører på http://localhost:3000
```

### 5. Test endepunktene
```bash
# Hent Kiwi-butikker nær Oslo
curl "http://localhost:3000/api/stores?lat=59.91&lng=10.75&km=2&group=KIWI"

# Søk etter produkt
curl "http://localhost:3000/api/products?search=helmelk+tine&unique=true"

# Hent priser for to EANs
curl -X POST http://localhost:3000/api/prices-bulk \
  -H "Content-Type: application/json" \
  -d '{"eans":["7038010055737","7039010019743"]}'
```

---

## Deploy til Vercel (anbefalt, gratis)

```bash
npm install -g vercel
vercel

# Legg til miljøvariabel i Vercel-dashboardet:
# KASSALAPP_API_KEY = din_nokkel
# ALLOWED_ORIGINS  = https://din-app.vercel.app
```

Vercel cacher API-svar automatisk basert på Cache-Control-headerne:
- Butikker: 24 timer (butikklister endres sjelden)
- Produkter og priser: 1 time

---

## Koble til Matpilot-appen

Importer funksjonene fra `lib/api-klient.js` i matpilot.jsx.
Filen inneholder ferdig kode og et brukseksempel i kommentarene.

### Steg 1 – Last butikker ved oppstart
Erstatt `SEED_BUTIKKER` med butikker hentet fra `/api/stores`.
`lastButikker()` returnerer alle sider automatisk.

### Steg 2 – Bruk ekte produktsøk
Kall `sokEkteProdukter(sokeord)` i søkefeltet (med 300 ms debounce)
og vis resultatene i stedet for filtrering av `VARER`-konstanten.

### Steg 3 – Hent ekte priser for handlekurven
Kall `hentBulkPriser(eans)` når handlekurven endres.
Konverter resultatet til appens `adminPriser`-format og kall `settPrisData()`.

```js
// Eksempel på konvertering:
// priser["7038010055737"]["KIWI"] = 27.9
// → adminPriser["pepsimax|kiwi_moholt"] = { pris: 27.9 }
//
// Merk: Kassalapp gir priser per KJEDE, ikke per BUTIKK.
// Prisen gjelder for alle butikker i samme kjede.
// Ekte butikk-spesifikke priser krever at brukere rapporterer avvik.
```

---

## Viktig om Kassalapp-lisens

**Hobby-planen** (gratis) tillater ikke kommersiell bruk.
Hvis Matpilot skal tjene penger (Premium-abonnement, annonsering), må du
oppgradere til **Bedriftsplanen** (750 kr/mnd).
Kontakt: helge@lisethsolutions.no

---

## Filstruktur

```
matpilot-api/
├── app/
│   └── api/
│       ├── stores/       route.js   – GET  /api/stores
│       ├── products/     route.js   – GET  /api/products
│       └── prices-bulk/  route.js   – POST /api/prices-bulk
├── lib/
│   ├── kassalapp.js    – Kassalapp API-klient (server-side)
│   └── api-klient.js   – Frontend-klient + brukseksempel
├── .env.example
├── next.config.mjs
└── package.json
```
