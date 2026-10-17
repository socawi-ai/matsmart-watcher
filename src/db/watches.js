// The watchlist: matsmart.se pages to check, with an optional keyword.
const { getDb } = require('./index');

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

// The outcome of checking one watch, inside a check's transaction:
// productIds replaces what the watch found last time.
async function saveWatchSuccess(db, watchId, productIds, checkedAt) {
  await db.run('DELETE FROM watch_products WHERE watch_id = ?', watchId);
  for (const productId of productIds) {
    await db.run('INSERT INTO watch_products (watch_id, product_id) VALUES (?, ?)', watchId, productId);
  }
  await db.run('UPDATE watches SET checked_at = ?, error = NULL WHERE id = ?', checkedAt, watchId);
}

async function saveWatchError(db, watchId, error) {
  await db.run('UPDATE watches SET error = ? WHERE id = ?', error, watchId);
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
  listWatchProductIds,
  listWatches,
  saveWatchError,
  saveWatchSuccess
};
