// The parsers against pages saved from matsmart.se on 2026-10-17 (evidence/).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseApiPage, parseListQueryUrl, parseProductPage } = require('../src/scraper/parse');

const evidence = (name) => fs.readFileSync(path.join(__dirname, '..', 'evidence', name), 'utf8');

test('a product page gives its own product, prices in öre', () => {
  assert.deepEqual(parseProductPage(evidence('product-in-stock.html')), {
    id: '68f207fe-2bdf-4c7c-8a60-a4873be28a66',
    title: 'Proteinbar Toffee Delight 15-pack',
    brand: 'Gainomax',
    url: 'https://www.matsmart.se/produkt/gainomax-proteinbar-toffee-delight-15-pack',
    image:
      'https://productimages.motatos.com/MS116922/ms116922_front-1a5741cc-2dcb-4f1e-a68a-d35952f16ae9.png?tr=n-thumbnail&itok=hxWlK-uw',
    price: 24900,
    originalPrice: 36900,
    stock: 101,
    bestBefore: '2027-07-16',
    inStock: true
  });
});

test('a product page with low stock', () => {
  const product = parseProductPage(evidence('product-low-1.html'));
  assert.equal(product.title, 'Gott & Blandat Familie Guf');
  assert.equal(product.stock, 2);
  assert.equal(product.price, 2900);
  assert.equal(product.originalPrice, 7500);
});

test('a page without a product of its own is refused', () => {
  assert.throws(() => parseProductPage(evidence('category.html')), /0 productDisplay/);
  assert.throws(() => parseProductPage(evidence('product-missing.html')), /0 productDisplay/);
});

test('list pages give their product list’s API address', () => {
  for (const page of ['category.html', 'brand.html', 'list.html']) {
    assert.match(parseListQueryUrl(evidence(page)), /^https:\/\/api\.motatos\.se\/jsonapi\/index\/products\?.*page%5Blimit%5D=18/);
  }
  // /sista-chansen's address is a reference to a text row.
  assert.match(parseListQueryUrl(evidence('list.html')), /sort=-ordered_count%2Cpublished/);
  assert.match(parseListQueryUrl(evidence('category.html')), /5971f7de-e3f8-44e2-a244-dd5dfc49a34e/);
});

test('a product page has no product list', () => {
  assert.throws(() => parseListQueryUrl(evidence('product-in-stock.html')), /0 produktlistor/);
});

test('API pages give products with prices in öre, and the next page', () => {
  const first = parseApiPage(evidence('list-api-0.json'));
  assert.equal(first.products.length, 18);
  assert.match(first.next, /page%5Boffset%5D=18/);
  assert.deepEqual(first.products[0], {
    id: '7f32b6a0-3f98-41c0-aa4c-23b595717317',
    title: 'Mjölkchoklad Cookie Dough',
    brand: 'Marabou',
    url: 'https://www.matsmart.se/produkt/marabou-mjolkchoklad-cookie-dough-1',
    image:
      'https://productimages.motatos.com/ms260670/ms260670-1-df3f85ca-4a25-4479-ae22-191cec0381e5.png?tr=n-thumbnail&itok=Wg7ZLjPq',
    price: 2500,
    originalPrice: 3000,
    stock: 2,
    bestBefore: '2026-12-18',
    inStock: true
  });

  const last = parseApiPage(evidence('list-api-8.json'));
  assert.equal(last.products.length, 10);
  assert.equal(last.next, null);
});

test('all of /sista-chansen: 154 products, multipacks included', () => {
  const products = [];
  for (let i = 0; i <= 8; i += 1) products.push(...parseApiPage(evidence(`list-api-${i}.json`)).products);
  assert.equal(new Set(products.map((p) => p.id)).size, 154);
  assert.ok(products.every((p) => Number.isInteger(p.price) && Number.isInteger(p.originalPrice)));
  // Non-food products have no best-before date.
  assert.ok(products.some((p) => p.bestBefore === null));
});

// 2 of 589 products in /kategori/skafferi had no normal_price (2026-10-17).
test('API product without normal_price and without a sale: no discount', () => {
  const satay = parseApiPage(evidence('skafferi-api-10.json')).products.find(
    (p) => p.id === '3265bd56-9398-4301-b52d-64e0d40b7833'
  );
  assert.equal(satay.price, 3200);
  assert.equal(satay.originalPrice, 3200);
  // The site's product page shows the same: old price = price.
  const fromPage = parseProductPage(evidence('product-no-normal-price-1.html'));
  assert.equal(fromPage.originalPrice, fromPage.price);
});

test('API product without normal_price on a sale: the price before the sale', () => {
  const mirin = parseApiPage(evidence('skafferi-api-30.json')).products.find(
    (p) => p.id === '5b69990c-b51a-4d4d-8e4c-710cd82728f2'
  );
  assert.equal(mirin.price, 2800);
  assert.equal(mirin.originalPrice, 3900);
});

test('API and product page agree on prices (same product)', () => {
  const fromApi = parseApiPage(evidence('category-api-page1.json')).products.find(
    (p) => p.id === '68f207fe-2bdf-4c7c-8a60-a4873be28a66'
  );
  const fromPage = parseProductPage(evidence('product-in-stock.html'));
  assert.equal(fromApi.price, fromPage.price);
  assert.equal(fromApi.originalPrice, fromPage.originalPrice);
});
