# Matsmart watcher

A small self-hosted app that watches [matsmart.se](https://www.matsmart.se) for the
products you care about and posts to Discord when something changes: a new product,
a price drop, something selling out or coming back in stock.

One Docker container, one SQLite file, a small web interface (in Swedish, like the
site it watches).

> **Unofficial.** Not affiliated with or endorsed by Matsmart/Motatos. It reads the
> same pages and product data the site's own pages load, so it can break whenever the
> site changes. matsmart.se's product list API (`api.motatos.se`) is disallowed for
> robots in its robots.txt; this app uses it to see whole lists. Use it for yourself,
> keep the check interval reasonable, and decide for yourself whether that's
> acceptable to you.

## What it does

- **Watch pages.** A watch is a matsmart.se address plus an optional keyword:
  - a product: `https://www.matsmart.se/produkt/…`
  - a category: `/kategori/proteinbars`
  - a brand: `/varumarke/marabou`
  - a list: `/sista-chansen`, `/nyinkommet`

  With a keyword, only products whose name or brand contains it count, e.g.
  `/kategori/proteinbars` + `lakrits`. Lists are read in full, not just the first
  screenful.
- **Check on a schedule.** Every 30 minutes by default, and whenever you press
  **Kontrollera nu**. Requests go one at a time, two seconds apart.
- **Notify on Discord.** One message per check that found changes, with one card per
  change: name, price (old → new), original price and discount, best-before date,
  stock and a link.

| Change | Sent when |
|---|---|
| **Ny** | the app sees a product for the first time (also on a new watch's first check) |
| **Tillbaka i lager** | a product it saw sell out is in stock again |
| **Slutsåld** | a product disappears from a watched list, or its product page says sold out or is gone |
| **Prissänkning** / **Prishöjning** | the price went down / up |

The web interface (login required) has four pages:

- **Bevakningar:** add, edit and remove watches; see when each was last checked and
  any error.
- **Produkter:** everything in stock across your watches, sortable by discount, price,
  best-before date or name.
- **Historik:** the latest 200 changes.
- **Inställningar:** choose which changes go to Discord, whether a new watch's first
  check is sent, pause notifications, and delete every message the app has sent.
  Everything is always recorded under Historik.

## Quick start

You need Docker (with Compose) and a Discord channel where you can add a webhook.

1. **Get the code and build the image.**

   ```bash
   git clone https://github.com/socawi-ai/matsmart-watcher.git
   cd matsmart-watcher
   docker build -t ghcr.io/socawi-ai/matsmart-watcher:latest .
   ```

2. **Create a Discord webhook.** In Discord: the channel's settings → Integrations →
   Webhooks → New Webhook → Copy Webhook URL.

3. **Configure.**

   ```bash
   cp .env.example .env
   ```

   Fill in these three:
   - `SESSION_SECRET`: a long random value, e.g. from `openssl rand -base64 32`
   - `DISCORD_WEBHOOK_URL`: the URL from step 2
   - `DEFAULT_ADMIN_PASSWORD`: the password you'll log in with

4. **Start it.**

   ```bash
   docker compose up -d
   ```

   Open http://localhost:3000 and log in as `admin` (or your
   `DEFAULT_ADMIN_USERNAME`) with your password. Add a watch, press **Kontrollera
   nu**, and what it finds arrives in Discord as **Ny**.

The account is created on the first start; changing those two variables afterwards
does nothing. If a required setting is missing or invalid, the app stops at startup
with a message naming it (see `docker compose logs`).

## Running it

- **Data:** accounts, watches, products, history and settings are in
  `./data/app.sqlite`, kept across restarts and upgrades. Back up that file to keep
  them.
- **Updating:** `git pull`, build the image again (step 1), then
  `docker compose up -d`.
- **Behind a reverse proxy (HTTPS):**
  - Publish the port on localhost only: `"127.0.0.1:3000:3000"` in
    `docker-compose.yml`.
  - Point the proxy at it.
  - Set `COOKIE_SECURE=true` so the login cookie is only sent over HTTPS.
    `TRUST_PROXY` then defaults to one proxy hop.
- **Prebuilt image:** pushes to `main` here publish
  `ghcr.io/socawi-ai/matsmart-watcher` (`latest`, and `v*` tags such as `v0.2.0`).
  It isn't public, so build your own as above. The workflow in
  `.github/workflows/docker-publish.yml` publishes to your own GHCR if you fork.

## Configuration

All settings are environment variables (or `.env`), documented in
[.env.example](.env.example).

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
| `MATSMART_WATCHER_VERSION` | | `latest` (the image tag Compose uses) |

## Limitations

- **Discord only.** One webhook, one account.
- **Big categories cost more requests.** Every product on a watched page is fetched
  on each check, e.g. 33 requests for a category of about 600 products. Prefer
  narrow pages, and use keywords to filter.
- **Old messages can't be deleted from the app.** It can only delete messages it sent
  through the current webhook.
- **Sold-out product pages haven't been seen yet.** If one turns out different from
  what the parser expects, that product watch shows an error instead of guessing.
  Lists simply drop sold-out products.

## Development

Node 22 or newer.

```bash
npm install
cp .env.example .env   # and fill it in
npm run dev            # http://localhost:3000, restarts on change
npm test               # node --test
```

- **Stack:** Express, EJS and SQLite, plain JavaScript (CommonJS), no build step.
- **Parser tests:** they run against pages saved from matsmart.se in `evidence/`.
- **Where things are:** [CLAUDE.md](CLAUDE.md) describes how the site's data is read
  (with the evidence for each fact) and how the code is laid out.

If the site changes and something breaks:
1. Save the page that fails to `evidence/`.
2. Find what changed.
3. Fix the parser.
4. Add a test against the saved page.

## License

[AGPL-3.0-or-later](LICENSE). If you run a modified version for others over a
network, you must offer them its source.
