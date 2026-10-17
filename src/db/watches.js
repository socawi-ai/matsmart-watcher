// The watchlist: matsmart.se pages to check, with an optional keyword.
const { getDb } = require('./index');
const { inTransaction } = require('./transaction');

// Every watch with how many products its last check found, oldest first.
async function listWatches() {
  const db = await getDb();
  return db.all(`
    SELECT w.*, COUNT(wp.product_id) AS product_count
    FROM watches w LEFT JOIN watch_products wp ON wp.watch_id = w.id
    GROUP BY w.id
    ORDER BY w.id
  `);
}

async function findWatchById(id) {
  const db = await getDb();
  return db.get('SELECT * FROM watches WHERE id = ?', id);
}

// Returns false when the same page and keyword are already watched.
async function createWatch({ path, keyword }) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO watches (path, keyword, created_at) VALUES (?, ?, ?) ON CONFLICT (path, keyword) DO NOTHING',
    path,
    keyword,
    new Date().toISOString()
  );
  return result.changes === 1;
}

async function deleteWatch(id) {
  const db = await getDb();
  await db.run('DELETE FROM watches WHERE id = ?', id);
}

// A new page or keyword: the watch starts over, as if just added. What it
// found before no longer applies, so it can't be reported as sold out.
// Returns false when another watch already has the same page and keyword.
function updateWatch(id, { path, keyword }) {
  return inTransaction(async (db) => {
    const taken = await db.get('SELECT 1 FROM watches WHERE path = ? AND keyword = ? AND id <> ?', path, keyword, id);
    if (taken) return false;
    await db.run('DELETE FROM watch_products WHERE watch_id = ?', id);
    await db.run('UPDATE watches SET path = ?, keyword = ?, checked_at = NULL, error = NULL WHERE id = ?', path, keyword, id);
    return true;
  });
}

// Whether the watch still exists with the page and keyword a check used:
// it may have been removed or edited while the check ran.
async function isUnchanged(db, watch) {
  return Boolean(await db.get('SELECT 1 FROM watches WHERE id = ? AND path = ? AND keyword = ?', watch.id, watch.path, watch.keyword));
}

// The outcome of checking one watch, inside a check's transaction:
// productIds replaces what the watch found last time.
async function saveWatchSuccess(db, watch, productIds, checkedAt) {
  await db.run('DELETE FROM watch_products WHERE watch_id = ?', watch.id);
  for (const productId of productIds) {
    await db.run('INSERT INTO watch_products (watch_id, product_id) VALUES (?, ?)', watch.id, productId);
  }
  await db.run('UPDATE watches SET checked_at = ?, error = NULL WHERE id = ?', checkedAt, watch.id);
}

async function saveWatchError(db, watch, error) {
  await db.run('UPDATE watches SET error = ? WHERE id = ?', error, watch.id);
}

// { watchId: [productId, …] } for every watch, from the last checks.
async function listWatchProductIds(db) {
  const rows = await db.all('SELECT watch_id, product_id FROM watch_products');
  const byWatch = new Map();
  for (const row of rows) {
    if (!byWatch.has(row.watch_id)) byWatch.set(row.watch_id, []);
    byWatch.get(row.watch_id).push(row.product_id);
  }
  return byWatch;
}

module.exports = {
  createWatch,
  deleteWatch,
  findWatchById,
  isUnchanged,
  listWatchProductIds,
  listWatches,
  saveWatchError,
  saveWatchSuccess,
  updateWatch
};
