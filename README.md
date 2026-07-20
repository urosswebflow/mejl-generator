# Mejl Generator

Next.js aplikacija za pretragu firmi (Google Places), praćenje leadova i generisanje email proposal-a (Gemini). Podaci se čuvaju u Supabase.

## Pokretanje

```bash
npm install
npm run dev
```

Otvori [http://localhost:3000](http://localhost:3000).

## Okruženje (`.env.local`)

### Obavezno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — za Resend webhook i cron brisanje Trash-a
- `GOOGLE_MAPS_API_KEY`
- `GEMINI_API_KEY`

### Resend (slanje + inbox)

Minimalna konfiguracija:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_DOMAINS` — npr. `tvojdomen.com,drugi-domen.com`

Više Resend naloga (JSON niz):

```env
RESEND_ACCOUNTS=[{"id":"account-1","apiKey":"re_...","webhookSecret":"whsec_...","domains":["domen1.com"]},{"id":"account-2","apiKey":"re_...","webhookSecret":"whsec_...","domains":["domen2.com"]}]
```

### Cron

- `CRON_SECRET` — za `/api/cron/purge-trash` (Vercel cron briše Trash stariji od 30 dana)

## Inbox / Resend webhook

Produkcijski webhook URL:

`https://mejlovi.vercel.app/api/resend/webhook`

Eventi:

- `email.received`
- `email.opened`
- `email.clicked`

## Skripte

- `npm run dev` — razvoj
- `npm run build` — produkcijski build
- `npm run lint` — ESLint
