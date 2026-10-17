// The web interface over HTTP: login, watchlist, products, history.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Before requiring the app: these are read when it loads.
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'matsmart-app-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/test';

const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { createUser } = require('../src/db');
const { listWatches } = require('../src/db/watches');

let server;
let baseUrl;

test.before(async () => {
  await createUser({ username: 'Admin', passwordHash: await bcrypt.hash('correct-horse', 4) });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

// A tiny browser: keeps the session cookie between requests and doesn't
// follow redirects, so tests can check where they point.
function browser() {
  let cookie = '';
  return async function request(pathname, { form, headers = {} } = {}) {
    const res = await fetch(baseUrl + pathname, {
      method: form ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...headers
      },
      body: form ? new URLSearchParams(form).toString() : undefined
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return res;
  };
}

async function loggedIn() {
  const request = browser();
  const res = await request('/auth/login', { form: { username: 'admin', password: 'correct-horse' } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/');
  return request;
}

test('every page needs a login', async () => {
  for (const page of ['/', '/products', '/history']) {
    const res = await browser()(page);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/auth/login');
  }
  const res = await browser()('/check', { form: { back: '/' } });
  assert.equal(res.headers.get('location'), '/auth/login');
});

test('a wrong password is refused', async () => {
  const res = await browser()('/auth/login', { form: { username: 'admin', password: 'wrong' } });
  assert.equal(res.status, 401);
  assert.match(await res.text(), /Ogiltiga inloggningsuppgifter/);
});

test('health check is open', async () => {
  const res = await browser()('/health');
  assert.equal(res.status, 200);
});

test('adding and removing a watch', async () => {
  const request = await loggedIn();

  let res = await request('/watches', { form: { url: 'https://www.matsmart.se/kategori/proteinbars', keyword: 'lakrits' } });
  assert.equal(res.headers.get('location'), '/');
  let page = await (await request('/')).text();
  assert.match(page, /\/kategori\/proteinbars \(”lakrits”\) bevakas nu/);
  assert.match(page, /<td>lakrits<\/td>/);

  res = await request('/watches', { form: { url: '/kategori/proteinbars', keyword: 'lakrits' } });
  page = await (await request('/')).text();
  assert.match(page, /bevakas redan/);

  res = await request('/watches', { form: { url: 'https://example.com/x', keyword: '' } });
  page = await (await request('/')).text();
  assert.match(page, /måste vara en sida på matsmart\.se/);

  const [watch] = await listWatches();
  await request(`/watches/${watch.id}/delete`, { form: {} });
  page = await (await request('/')).text();
  assert.match(page, /bevakas inte längre/);
  assert.equal((await listWatches()).length, 0);
});

test('products and history pages', async () => {
  const request = await loggedIn();
  let res = await request('/products?sort=price');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Inga produkter i lager/);
  // An unknown sort is ignored.
  res = await request('/products?sort=price;DROP TABLE products');
  assert.equal(res.status, 200);
  res = await request('/history');
  assert.match(await res.text(), /Inga förändringar än/);
});

test('"Kontrollera nu" starts a check and goes back to the page', async () => {
  const request = await loggedIn();
  const res = await request('/check', { form: { back: '/history' } });
  assert.equal(res.headers.get('location'), '/history');
  assert.match(await (await request('/history')).text(), /Kontrollen har startat|En kontroll pågår redan/);
});

test('changes from other sites are refused', async () => {
  const request = await loggedIn();
  const res = await request('/watches', { form: { url: '/sista-chansen' }, headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(res.status, 403);
});
