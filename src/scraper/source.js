// What a watched page offers right now: fetches it (and, for lists, every
// page of its product list) and parses the products.
const { SITE_ORIGIN, isProductPath } = require('../matsmart');
const { fetchText } = require('./fetch');
const { parseApiPage, parseListQueryUrl, parseProductPage } = require('./parse');

function expectOk({ status, location }, url) {
  if (status !== 200) {
    const moved = location ? ` (flyttad till ${location})` : '';
    throw new Error(`${url} svarade ${status}${moved}.`);
  }
}

// A product page: the product, or nothing when the page is gone (404).
async function scrapeProduct(path) {
  const url = SITE_ORIGIN + path;
  const res = await fetchText(url);
  if (res.status === 404) return [];
  expectOk(res, url);
  return [parseProductPage(res.text)];
}

// A list page: every product in its list, following the API's pages.
async function scrapeList(path) {
  const url = SITE_ORIGIN + path;
  const res = await fetchText(url);
  expectOk(res, url);

  const products = new Map();
  let next = parseListQueryUrl(res.text);
  while (next) {
    const apiRes = await fetchText(next);
    expectOk(apiRes, next);
    const page = parseApiPage(apiRes.text);
    // Products can shift between pages while paging; each counts once.
    for (const product of page.products) products.set(product.id, product);
    next = page.next;
  }
  return [...products.values()];
}

function scrapeWatch(path) {
  return isProductPath(path) ? scrapeProduct(path) : scrapeList(path);
}

module.exports = { scrapeWatch };
