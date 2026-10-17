# Matsmart watcher

Self-hosted app that watches matsmart.se for specific products, stores their state,
sends Discord alerts on changes, and has a small web interface. It runs as a single
Docker container.

## Working method: detective first
1. Form a theory of the problem.
2. Collect evidence: saved HTML, logs, a failing test, actual output.
3. Only change code once the evidence proves the theory.
4. Never "fix" based on a plausible theory alone. If the evidence is missing, add
   minimal targeted logging and gather it first.

## Design principles
- Simple beats complex. Don't overengineer.
- One correct path. No fallbacks, no alternative code paths, no backups.
- Fail fast: throw clear errors when preconditions aren't met.
- Clear code beats backward compatibility.
- Each function has a single responsibility.
- Make surgical, minimal changes. Fix root causes, not symptoms.
- When there are several reasonable approaches, ask me before choosing.

## Stack and structure
This app reuses the structure of small cms (`/root/projects/webapp-starter`).
When unsure how to build something, look at how small cms does it and follow that.
Don't introduce a new library or pattern if small cms already has one for the job.
- Separate app: own repo, own database, own container.
- small cms is read-only reference. Never import from it or edit its files.
- Copied code becomes this app's own. Remove anything from small cms the watcher
  doesn't need.

Agreed after Phase 0 (2026-10-17):
- Plain JavaScript, CommonJS, Node 22+, no build step (like small cms; no TypeScript).
- Express 5, EJS views, express-session, bcryptjs, express-rate-limit.
- SQLite via `sqlite` + `sqlite3`: one shared connection (`getDb()`), append-only
  migrations tracked by `PRAGMA user_version`, raw SQL in `src/db/<feature>.js`,
  multi-statement writes through `inTransaction`.
- Auth as in small cms (session login, `attachUser` + `requireAuth`, login rate
  limit, session versions). Every page except `/auth` and `/health` needs login.
  The first admin is created on first start only, from `DEFAULT_ADMIN_USERNAME` /
  `DEFAULT_ADMIN_PASSWORD` (required while no user exists); no seed script.
- `src/config.js` reads every env var once and throws if a required one is missing.
- Scheduler is a plain `setInterval` with a guard against overlapping runs.
- Interface, flash and log messages in Swedish; code and comments in English.
- Tests: `node:test` + `node:assert/strict` in `test/`.
- Docker: Dockerfile like small cms; compose builds locally (`build: .`), no GHCR
  workflow, no changelog machinery.

## Responsibilities (keep these separate)
- Fetching pages (HTTP only)
- Parsing products (HTML/JSON to typed objects only)
- Storage (watchlist, product state, change history)
- Diffing (stored state + new scrape -> change events)
- Notifying (change events -> Discord message)
- Web interface (watchlist, products, history, "check now")
- Config (read env vars, throw if a required one is missing)

## matsmart.se facts (verified)
- Next.js on Vercel. Product data is in the server-rendered HTML.
- URL patterns: `/produkt/<slug>`, `/kategori/<slug>`, `/varumarke/<slug>`, and list
  pages like `/nyinkommet` and `/sista-chansen`.
- robots.txt disallows `/search?q=*`. Never use the site search.
- Polite scraping: fetch sequentially, use a clear User-Agent, add a delay between
  requests, and don't check more often than the configured interval.
- Saved evidence lives in `evidence/` (fetched 2026-10-17). Use it for parser tests.

Verified in Phase 1 (2026-10-17):
- **No `__NEXT_DATA__`.** It's the App Router: data is in an RSC flight payload, the
  string argument of each `<script>self.__next_f.push([1,"…"])</script>`, joined.
  The payload is rows `<hex id>:<JSON>\n`, except text rows `<hex id>:T<hex byte
  length>,<text>` which have no trailing newline (read exactly that many UTF-8
  bytes). `"$<id>"` strings reference another row. JSON-LD has no product data.
  (`category.html`, `brand.html`, `list.html`)
- **Product page:** the product is the object under the key `productDisplay` in an
  RSC row (`$[0][3].productDisplay` in all 5 product files). The page also renders
  18 recommended products in its HTML; ignore them. (`product-in-stock.html`,
  `product-low-*.html`)
- **List pages** (category, brand, `/sista-chansen`): the HTML holds only the first
  18 products (`page[limit]=18`), inside a react-query infinite-query object
  (`{ pages: [{ data, meta: { count }, links }], pageParams }`, path varies per page).
  `?page=2` is ignored (`category-page2-param.html`). The rest come from
  `https://api.motatos.se/jsonapi/index/products?…`: take `pages[0].links.self.href`
  (may be a `$<id>` reference to a text row), fetch it, follow `links.next.href`
  until absent. `/sista-chansen`: 9 requests, 154 of `meta.count` 154, unique ids
  (`list-api-0.json` … `list-api-8.json`).
- api.motatos.se's robots.txt is `Disallow: /` (`api-robots.html`). The owner
  decided to use it anyway (personal use). Keep requests polite.
- **Product object** (same in RSC and API): `id` (UUID), `type` `product--default`
  or `product--multipack`, `attributes.title`, `attributes.computed_brand.name`,
  `attributes.path.alias` (`/produkt/<slug>`), `attributes.out_of_stock`, and
  `attributes.computed_variations` (exactly 1 on every product checked: 53 from pages, 154 from the API):
  `sku`, `stock`, `best_before` (`YYYY-MM-DD`, empty for non-food), 
  `days_left_in_stock`, `computed_images[0].styles.thumbnail` (on
  `productimages.motatos.com`).
- **Prices differ by source.** RSC: `prices.price.amount` and `prices.old_price.amount`,
  integers in öre (24900 renders as "249"). API: `resolved_price.number` and
  `normal_price.number`, strings in kronor (`"149.000000"`); its `prices[0].list_price`
  is always null. Matched on 18 of 18 products (`category-api-page1.json`).
  No discount field: compute it from the two prices.
- **API `normal_price` can be null** (2 of 589 in `/kategori/skafferi`, both
  `purchase_reason_name` "SavedBestBeforeDate"; `skafferi-api-10.json`, `-30.json`).
  Without a sale (`prices[0].sale_price` false) the product page shows old price =
  price (`product-no-normal-price-1.html`), so original = price. On a sale, the
  owner chose original = `lowest_price_before_sale` (Mirin: 28 kr, before 39).
  Mirin's product page still showed 39/39 while the API said 28 (re-fetched:
  `skafferi-api-30-again.json`); likely a cached page, unverified.
- `stock` is capped at 101 (38 of 53), read as "more than 100".
- "Snart slutsåld" (site text: expected to sell out within two days) is not a field.
  It correlates with `days_left_in_stock` ≤ ~3; not used by the watcher.
- Lists filter `out_of_stock <> 1` and `exclude_from_lists <> 1`, so a sold-out
  product disappears from category, brand and list pages.
- An unknown `/produkt/<slug>` returns 404, no redirect (`product-missing.html`).
- **Unverified:** what a sold-out product page looks like (no example found yet).

## Domain rules
- A watch is a matsmart URL (product, category, brand or list page) plus an optional
  keyword filter.
- Change types: `new`, `back_in_stock`, `sold_out`, `price_drop`, `price_up`.
- One Discord message per run, sent only if there are changes.

## Architecture
- `src/server.js`: loads `.env`, reads `src/config.js` (throws on a missing/invalid
  setting), opens the DB (runs migrations), creates the first account, listens,
  then starts the scheduler (one check at startup, then every interval).
- Fetching: `src/scraper/fetch.js` (`fetchText`: User-Agent, 2 s between requests,
  no redirects followed). `src/scraper/source.js` (`scrapeWatch(path)`): product
  page → `[product]` or `[]` on 404; list page → HTML for the query URL, then
  every API page.
- Parsing: `src/scraper/flight.js` (RSC rows), `src/scraper/parse.js` (product
  objects, prices in öre; throws naming the missing field).
- Diffing: `src/diff.js` (pure). Storage: `src/db/{watches,products,changes}.js`.
- `src/check.js` (`runCheck({ scrapeWatch, notify })`): scrape every watch, filter
  by keyword, diff and store in one transaction, notify once. A failed watch keeps
  its error on the row and its products aren't called sold out. `new` means the
  watcher has never seen the product (any watch), also on a watch's first check
  (owner's choice, 2026-10-17). Editing a watch's page or keyword clears what it
  found, so those products aren't reported sold out.
- `src/notify/discord.js`: one message, max 10 embeds, the rest noted.
- `src/notify/settings.js`: what's sent, set on `/settings` and stored in the
  `settings` key/value table (migration 2, `src/db/settings.js`): change types,
  `firstCheck` (send `new` that only watches' first checks found; `check.js`
  marks those changes `firstCheck`), `paused`. Defaults: send everything.
  `changesToSend` filters; everything is recorded regardless.
- Sent messages: `sendMessage` posts with `?wait=true` to get the message id, stored
  in `discord_messages` (migration 3). `deleteSentMessages`
  (`src/notify/sent-messages.js`) deletes them one by one through the webhook
  (`DELETE …/messages/<id>`: 204 deleted, 404 already gone, 429 wait
  `retry_after`), forgetting each as it goes. A webhook can't list or delete
  messages it didn't send, so messages from before 2026-10-17 can't be removed.
- `src/scheduler.js`: `checkNow()` (no overlap), status shown on every page.
- Web: `src/app.js` (headers, CSP with `productimages.motatos.com`, session,
  `requireAuth` on everything but `/auth` and `/health`), routes in `src/routes/`,
  views in `views/` (no inline scripts or styles: the CSP forbids them).

## Commands
```bash
npm install
npm run dev        # http://localhost:3000, restarts on change (needs .env)
npm test           # node --test, all of test/
docker compose up -d --build
```
Tests set `APP_DATA_DIR` (temp dir), `SESSION_SECRET` and `DISCORD_WEBHOOK_URL`
before requiring app modules: `src/config.js` reads them when it loads.

## Env vars
See `.env.example`. Required: `SESSION_SECRET`, `DISCORD_WEBHOOK_URL`, and
`DEFAULT_ADMIN_PASSWORD` while no account exists. Optional: `CHECK_INTERVAL_MINUTES`
(30), `DEFAULT_ADMIN_USERNAME` (admin), `PORT` (3000), `TZ`, `COOKIE_SECURE`,
`TRUST_PROXY`, `APP_DATA_DIR` (tests).
