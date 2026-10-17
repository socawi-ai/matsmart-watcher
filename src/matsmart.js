// Addresses on matsmart.se and which of them can be watched.
const SITE_ORIGIN = 'https://www.matsmart.se';
// The product list API the site's own pages page through (see CLAUDE.md).
const API_PRODUCTS_URL = 'https://api.motatos.se/jsonapi/index/products?';

const SITE_HOSTS = ['www.matsmart.se', 'matsmart.se'];

// What was typed in the watch form (a full address or a path) → the page's
// path, e.g. '/kategori/proteinbars'. Returns { path } or { error }.
function readWatchPath(input) {
  let url;
  try {
    url = new URL(input, SITE_ORIGIN);
  } catch {
    return { error: 'Adressen går inte att läsa.' };
  }
  if (url.protocol !== 'https:' || !SITE_HOSTS.includes(url.hostname)) {
    return { error: 'Adressen måste vara en sida på matsmart.se.' };
  }
  if (url.search) {
    return { error: 'Adressen får inte ha filter eller sökning (det som börjar med ?).' };
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (!/^(\/[a-z0-9-]+){1,2}$/.test(path)) {
    return { error: 'Adressen ska vara en produkt-, kategori-, varumärkes- eller listsida.' };
  }
  return { path };
}

const isProductPath = (path) => path.startsWith('/produkt/');

// Whether a product belongs to a watch: its name or brand contains the
// keyword, ignoring case. An empty keyword matches everything.
function matchesKeyword(product, keyword) {
  const haystack = `${product.title} ${product.brand}`.toLocaleLowerCase('sv');
  return haystack.includes(keyword.toLocaleLowerCase('sv'));
}

module.exports = { API_PRODUCTS_URL, SITE_ORIGIN, isProductPath, matchesKeyword, readWatchPath };
