// Turns matsmart.se's data into product objects:
//   { id, title, brand, url, image, price, originalPrice, stock, bestBefore, inStock }
// Prices are integers in öre. bestBefore is 'YYYY-MM-DD' or null (non-food).
// image is a thumbnail URL or null. The field paths are in CLAUDE.md
// ("matsmart.se facts"), with the evidence files they were read from.
const { API_PRODUCTS_URL, SITE_ORIGIN } = require('../matsmart');
const { findObjects, readRows, resolveText } = require('./flight');

// A value the product can't do without; throws naming it when it's missing.
function need(value, name, productId) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Produkt ${productId} saknar ${name}.`);
  }
  return value;
}

// Every product checked had exactly one variation; anything else is new.
function onlyVariation(node) {
  const variations = need(node.attributes.computed_variations, 'computed_variations', node.id);
  if (variations.length !== 1) {
    throw new Error(`Produkt ${node.id} har ${variations.length} varianter, väntade 1.`);
  }
  return variations[0];
}

// The fields both sources share; only the prices differ.
function productFields(node, variation) {
  const a = node.attributes;
  const image = (variation.computed_images || [])[0];
  return {
    id: need(node.id, 'id', node.id),
    title: need(a.title, 'title', node.id).trim(),
    brand: need(a.computed_brand && a.computed_brand.name, 'computed_brand.name', node.id),
    url: SITE_ORIGIN + need(a.path && a.path.alias, 'path.alias', node.id),
    image: image ? image.styles.thumbnail : null,
    stock: need(variation.stock, 'stock', node.id),
    bestBefore: variation.best_before || null,
    inStock: !outOfStock(a, node.id)
  };
}

function outOfStock(attributes, productId) {
  if (typeof attributes.out_of_stock !== 'boolean') {
    throw new Error(`Produkt ${productId} saknar out_of_stock.`);
  }
  return attributes.out_of_stock;
}

// A product as it is in a product page's RSC data: prices in öre.
function productFromRsc(node) {
  const variation = onlyVariation(node);
  const prices = need(variation.prices, 'prices', node.id);
  return {
    ...productFields(node, variation),
    price: need(prices.price, 'prices.price', node.id).amount,
    originalPrice: need(prices.old_price, 'prices.old_price', node.id).amount
  };
}

// '149.000000' (kronor) → 14900 (öre).
const oreFromKronor = (number) => Math.round(Number(number) * 100);

// A product as the list API returns it: prices as kronor strings.
function productFromApi(node) {
  const variation = onlyVariation(node);
  const price = oreFromKronor(need(variation.resolved_price, 'resolved_price', node.id).number);
  return {
    ...productFields(node, variation),
    price,
    originalPrice: originalPriceFromApi(node, variation, price)
  };
}

// Usually normal_price. A few products have none (2 of 589 in
// skafferi-api-*.json): on a sale (prices[0].sale_price) the price before
// it is lowest_price_before_sale; otherwise there's no discount and the
// site's product page shows the price itself as the old price.
function originalPriceFromApi(node, variation, price) {
  if (variation.normal_price) return oreFromKronor(variation.normal_price.number);
  const offer = need(variation.prices, 'prices', node.id)[0];
  if (offer.sale_price) {
    return oreFromKronor(need(variation.lowest_price_before_sale, 'lowest_price_before_sale', node.id).number);
  }
  return price;
}

function exactlyOne(found, what) {
  if (found.length !== 1) {
    throw new Error(`Hittade ${found.length} ${what} på sidan, väntade 1.`);
  }
  return found[0];
}

// A product page (/produkt/…) → its product. The page also shows
// recommended products; only the one under productDisplay is the page's own.
function parseProductPage(html) {
  const rows = readRows(html);
  const holders = findObjects(rows, '"productDisplay"', (node) => node.productDisplay !== undefined);
  return productFromRsc(exactlyOne(holders, 'productDisplay').productDisplay);
}

// A list page (category, brand, /sista-chansen …) → the API address of its
// product list's first page. The page itself only holds the first 18.
function parseListQueryUrl(html) {
  const rows = readRows(html);
  const queries = findObjects(
    rows,
    '"pageParams"',
    (node) => Array.isArray(node.pages) && node.pageParams !== undefined && Boolean(node.pages[0] && node.pages[0].links)
  );
  const url = resolveText(rows, exactlyOne(queries, 'produktlistor').pages[0].links.self.href);
  if (!url.startsWith(API_PRODUCTS_URL)) {
    throw new Error(`Produktlistans adress är inte API:ets: ${url}`);
  }
  return url;
}

// One page of the list API (JSON text) → its products and the next page's
// address (null on the last page).
function parseApiPage(json) {
  const page = JSON.parse(json);
  if (!Array.isArray(page.data)) {
    throw new Error('API-svaret saknar data.');
  }
  return {
    products: page.data.map(productFromApi),
    next: page.links && page.links.next ? page.links.next.href : null
  };
}

module.exports = { parseApiPage, parseListQueryUrl, parseProductPage };
