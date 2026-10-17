// A check from scrape to stored changes, with scraping and Discord faked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Before requiring the app: these are read when it loads.
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'matsmart-check-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/test';

const { runCheck } = require('../src/check');
const { createWatch, listWatches } = require('../src/db/watches');
const { listInStockProducts } = require('../src/db/products');
const { listRecentChanges } = require('../src/db/changes');

const product = (id, overrides) => ({
  id,
  title: `Proteinbar ${id}`,
  brand: 'Gainomax',
  url: `https://www.matsmart.se/produkt/${id}`,
  image: null,
  price: 1000,
  originalPrice: 2000,
  stock: 10,
  bestBefore: '2027-01-01',
  inStock: true,
  ...overrides
});

// What each path offers in the next check; a function throws instead.
let site = {};
const scrapeWatch = async (watchPath) => {
  const offer = site[watchPath];
  if (typeof offer === 'function') return offer();
  return offer;
};
let sent = [];
const notify = async (changes) => {
  sent.push(changes);
};
const check = () => runCheck({ scrapeWatch, notify });
const types = (changes) => changes.map((change) => `${change.type}:${change.product.id}`).sort();

test('checks find, store and report changes', async (t) => {
  await createWatch({ path: '/kategori/proteinbars', keyword: '' });
  await createWatch({ path: '/varumarke/gainomax', keyword: 'lakrits' });

  await t.test('first check: products stored, nothing announced', async () => {
    site = {
      '/kategori/proteinbars': [product('a'), product('b')],
      '/varumarke/gainomax': [product('c', { title: 'Lakritsbar' }), product('d')]
    };
    const result = await check();
    assert.deepEqual(result, { watches: 2, failed: 0, products: 3, changes: 0 });
    assert.equal(sent.length, 0);
    // The keyword left out "d".
    assert.deepEqual((await listInStockProducts('name')).map((p) => p.id).sort(), ['a', 'b', 'c']);
  });

  await t.test('second check: new, price changes and sold out, in one message', async () => {
    site = {
      '/kategori/proteinbars': [product('a', { price: 800 }), product('e')],
      '/varumarke/gainomax': [product('c', { title: 'Lakritsbar', price: 1200 })]
    };
    const result = await check();
    assert.equal(result.changes, 4);
    assert.equal(sent.length, 1);
    assert.deepEqual(types(sent[0]), ['new:e', 'price_drop:a', 'price_up:c', 'sold_out:b']);
    const drop = sent[0].find((change) => change.type === 'price_drop');
    assert.equal(drop.oldPrice, 1000);
    assert.equal(drop.newPrice, 800);
    assert.deepEqual(types((await listRecentChanges(10)).map((row) => ({ type: row.type, product: { id: row.product_id } }))), [
      'new:e',
      'price_drop:a',
      'price_up:c',
      'sold_out:b'
    ]);
  });

  await t.test('nothing changed: no message', async () => {
    sent = [];
    const result = await check();
    assert.equal(result.changes, 0);
    assert.equal(sent.length, 0);
  });

  await t.test('back in stock', async () => {
    site['/kategori/proteinbars'] = [product('a', { price: 800 }), product('e'), product('b')];
    await check();
    assert.deepEqual(types(sent[0]), ['back_in_stock:b']);
  });

  await t.test('a failed watch is reported and its products are not called sold out', async () => {
    sent = [];
    site['/kategori/proteinbars'] = () => {
      throw new Error('https://www.matsmart.se/kategori/proteinbars svarade 500.');
    };
    const result = await check();
    assert.equal(result.failed, 1);
    assert.equal(sent.length, 0);
    const watch = (await listWatches()).find((w) => w.path === '/kategori/proteinbars');
    assert.match(watch.error, /svarade 500/);
    // What it found last time is still listed.
    assert.equal(watch.product_count, 3);
  });

  await t.test('a working check clears the error', async () => {
    site['/kategori/proteinbars'] = [product('a', { price: 800 }), product('e'), product('b')];
    await check();
    const watch = (await listWatches()).find((w) => w.path === '/kategori/proteinbars');
    assert.equal(watch.error, null);
  });

  await t.test('a product page that says out of stock', async () => {
    await createWatch({ path: '/produkt/f', keyword: '' });
    site['/produkt/f'] = [product('f')];
    await check();
    sent = [];
    site['/produkt/f'] = [product('f', { inStock: false })];
    await check();
    assert.deepEqual(types(sent[0]), ['sold_out:f']);
  });

  await t.test('a product page that is gone (no products)', async () => {
    site['/produkt/f'] = [product('f')];
    await check();
    sent = [];
    site['/produkt/f'] = [];
    await check();
    assert.deepEqual(types(sent[0]), ['sold_out:f']);
  });
});
