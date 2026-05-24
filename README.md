# Mejl Generator

Next.js aplikacija za pretragu firmi (Google Places), praćenje leadova i generisanje email proposal-a (Gemini). Podaci se čuvaju u Supabase.

## Pokretanje

```bash
npm install
npm run dev
```

Otvori [http://localhost:3000](http://localhost:3000).

## Okruženje (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_MAPS_API_KEY`
- `GEMINI_API_KEY`

## Skripte

- `npm run dev` — razvoj
- `npm run build` — produkcijski build
- `npm run lint` — ESLint
