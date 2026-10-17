// One check of every watch: scrape → filter by keyword → diff against the
// stored state → store → one Discord message if anything changed.
const { matchesKeyword } = require('./matsmart');
const { productChange, vanishedProductIds } = require('./diff');
const { inTransaction } = require('./db/transaction');
const { isUnchanged, listWatchProductIds, listWatches, saveWatchError, saveWatchSuccess } = require('./db/watches');
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
// Results of watches removed or edited while the check ran are dropped:
// they describe a watch that no longer exists.
function storeResults(allResults) {
  const now = new Date().toISOString();
  return inTransaction(async (db) => {
    const results = [];
    for (const result of allResults) {
      if (await isUnchanged(db, result.watch)) results.push(result);
    }
    const stored = await mapAllProducts(db);
    const linked = await listWatchProductIds(db);
    const found = new Map();
    // Products a watch found that had been checked before: the rest only
    // turned up in watches' first checks.
    const foundByCheckedWatch = new Set();
    for (const { watch, products } of results.filter((result) => !result.error)) {
      for (const product of products) {
        found.set(product.id, product);
        if (watch.checked_at) foundByCheckedWatch.add(product.id);
      }
    }

    const changes = [];
    for (const product of found.values()) {
      const before = stored.get(product.id);
      const type = productChange(before, product);
      await saveProduct(db, product, now);
      if (type) {
        const firstCheck = type === 'new' && !foundByCheckedWatch.has(product.id);
        changes.push({ type, product, oldPrice: before ? before.price : null, newPrice: product.price, firstCheck });
      }
    }

    const failedIds = new Set(results.filter((result) => result.error).map((result) => result.watch.id));
    for (const id of vanishedProductIds(stored, linked, new Set(found.keys()), failedIds)) {
      const product = { ...stored.get(id), inStock: false };
      await markSoldOut(db, id, now);
      changes.push({ type: 'sold_out', product, oldPrice: null, newPrice: product.price, firstCheck: false });
    }

    for (const change of changes) await insertChange(db, change, now);
    for (const { watch, products, error } of results) {
      if (error) await saveWatchError(db, watch, error);
      else await saveWatchSuccess(db, watch, products.map((product) => product.id), now);
    }
    return changes;
  });
}

// { watches, failed, products, changes, sent } for the check that just ran.
// scrapeWatch(path) → products; notify(changes) sends what the settings
// allow and returns how many it sent.
async function runCheck({ scrapeWatch, notify }) {
  const watches = await listWatches();
  const results = await scrapeAll(watches, scrapeWatch);
  const changes = await storeResults(results);
  const sent = changes.length ? await notify(changes) : 0;
  return {
    watches: watches.length,
    failed: results.filter((result) => result.error).length,
    products: results.reduce((sum, result) => sum + (result.products ? result.products.length : 0), 0),
    changes: changes.length,
    sent
  };
}

module.exports = { runCheck };
