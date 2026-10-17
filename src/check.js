// One check of every watch: scrape → filter by keyword → diff against the
// stored state → store → one Discord message if anything changed.
const { matchesKeyword } = require('./matsmart');
const { productChange, vanishedProductIds } = require('./diff');
const { inTransaction } = require('./db/transaction');
const { listWatchProductIds, listWatches, saveWatchError, saveWatchSuccess } = require('./db/watches');
const { mapAllProducts, markSoldOut, saveProduct } = require('./db/products');
const { insertChange } = require('./db/changes');

// Scrapes each watch in turn. A watch that fails is reported with its
// error; the others are still checked.
async function scrapeAll(watches, scrapeWatch) {
  const results = [];
  for (const watch of watches) {
    try {
      const products = (await scrapeWatch(watch.path)).filter((product) => matchesKeyword(product, watch.keyword));
      results.push({ watch, products });
    } catch (err) {
      console.error(`Bevakning ${watch.id} (${watch.path}) misslyckades: ${err.message}`);
      results.push({ watch, error: err.message });
    }
  }
  return results;
}

// Diffs and stores the results in one transaction; returns the changes.
// A watch's first successful check only records what it found: its
// products aren't announced as new, so adding a big list doesn't flood
// Discord.
function storeResults(results) {
  const now = new Date().toISOString();
  return inTransaction(async (db) => {
    const stored = await mapAllProducts(db);
    const linked = await listWatchProductIds(db);
    const found = new Map();
    const announceNew = new Set();
    for (const { watch, products } of results.filter((result) => !result.error)) {
      for (const product of products) {
        found.set(product.id, product);
        if (watch.checked_at) announceNew.add(product.id);
      }
    }

    const changes = [];
    for (const product of found.values()) {
      const before = stored.get(product.id);
      const type = productChange(before, product);
      await saveProduct(db, product, now);
      if (type && (type !== 'new' || announceNew.has(product.id))) {
        changes.push({ type, product, oldPrice: before ? before.price : null, newPrice: product.price });
      }
    }

    const failedIds = new Set(results.filter((result) => result.error).map((result) => result.watch.id));
    for (const id of vanishedProductIds(stored, linked, new Set(found.keys()), failedIds)) {
      const product = { ...stored.get(id), inStock: false };
      await markSoldOut(db, id, now);
      changes.push({ type: 'sold_out', product, oldPrice: null, newPrice: product.price });
    }

    for (const change of changes) await insertChange(db, change, now);
    for (const { watch, products, error } of results) {
      if (error) await saveWatchError(db, watch.id, error);
      else await saveWatchSuccess(db, watch.id, products.map((product) => product.id), now);
    }
    return changes;
  });
}

// { watches, failed, products, changes } for the check that just ran.
// scrapeWatch(path) → products, notify(changes) sends them.
async function runCheck({ scrapeWatch, notify }) {
  const watches = await listWatches();
  const results = await scrapeAll(watches, scrapeWatch);
  const changes = await storeResults(results);
  if (changes.length) await notify(changes);
  return {
    watches: watches.length,
    failed: results.filter((result) => result.error).length,
    products: results.reduce((sum, result) => sum + (result.products ? result.products.length : 0), 0),
    changes: changes.length
  };
}

module.exports = { runCheck };
