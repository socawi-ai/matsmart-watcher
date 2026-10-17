# Matsmart watcher

A small self-hosted app that watches matsmart.se for products and tells you on
Discord when something changes. One Docker container, one SQLite file.

## What it does

- **Watches** are matsmart.se pages: a product (`/produkt/…`), a category
  (`/kategori/…`), a brand (`/varumarke/…`) or a list (`/sista-chansen`,
  `/nyinkommet`), plus an optional keyword. With a keyword, only products whose
  name or brand contains it count (`/kategori/proteinbars` + `lakrits`).
- **Checks** run every `CHECK_INTERVAL_MINUTES` (default 30), and when you press
  **Kontrollera nu**. Each check fetches every watched page, one request at a
  time with a 2-second pause between them, and gets every product on a list,
  not just the first screenful.
- **Changes** found: `new` (Ny), `back_in_stock` (Tillbaka i lager), `sold_out`
  (Slutsåld), `price_drop` (Prissänkning) and `price_up` (Prishöjning). "Ny" is a
  product the app has never seen before, so a new watch's first check sends what
  it matches (a big list too: the first 10 in the message, the rest under Historik).
- **Discord**: one message per check that found changes, with one embed per change
  (name, price old → new, original price and discount, best-before date, stock,
  link, picture). Discord takes 10 embeds per message; the rest are under Historik.
- **Web interface** (login required):
  - **Bevakningar**: add and remove watches, see when each was last checked and any error.
  - **Produkter**: everything in stock across all watches, sortable by discount,
    price, best-before date or name.
  - **Historik**: the latest 200 changes.
  - **Inställningar**: which changes are sent to Discord (per type), whether a
    new or edited watch's first check sends what it finds, and a pause switch.
    Every change is still recorded under Historik. **Ta bort alla skickade
    notiser** deletes every message the app has sent to Discord (through the
    current webhook); it doesn't touch Historik.

## Run with Docker

```bash
cp .env.example .env
# Fill in SESSION_SECRET, DISCORD_WEBHOOK_URL and DEFAULT_ADMIN_PASSWORD.
docker compose up -d --build
```

Open http://localhost:3000 and log in with `DEFAULT_ADMIN_USERNAME` /
`DEFAULT_ADMIN_PASSWORD`. The account is created on the first start; changing
those variables later does nothing. Data (accounts, watches, products, history)
is in `./data/app.sqlite`, kept between restarts and image upgrades.

To update: `git pull && docker compose up -d --build`.

### Behind a reverse proxy (HTTPS)

Publish the port on localhost only (`"127.0.0.1:3000:3000"` in
`docker-compose.yml`), point the proxy at it, and set `COOKIE_SECURE=true` so the
login cookie is only sent over HTTPS. `TRUST_PROXY` then defaults to one hop.

## Configuration

All settings are environment variables (or `.env`), documented in
[.env.example](.env.example). The app stops at startup with a message naming
the variable if a required one is missing or invalid.

| Variable | Required | Default |
|---|---|---|
| `SESSION_SECRET` | yes | |
| `DISCORD_WEBHOOK_URL` | yes | |
| `DEFAULT_ADMIN_PASSWORD` | until the account exists | |
| `DEFAULT_ADMIN_USERNAME` | | `admin` |
| `CHECK_INTERVAL_MINUTES` | | `30` |
| `PORT` | | `3000` |
| `TZ` | | `Europe/Stockholm` (Docker) |
| `COOKIE_SECURE` | | `false` |
| `TRUST_PROXY` | | one hop if `COOKIE_SECURE=true`, else none |

## Development

Node 22 or newer.

```bash
npm install
cp .env.example .env   # and fill it in
npm run dev            # http://localhost:3000, restarts on change
npm test               # node --test
```

The parser tests run against pages saved from matsmart.se in `evidence/`.
