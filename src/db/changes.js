// The change log: one row per change event a check found.
const { getDb } = require('./index');

async function insertChange(db, { type, product, oldPrice, newPrice }, now) {
  await db.run(
    'INSERT INTO changes (product_id, type, old_price, new_price, created_at) VALUES (?, ?, ?, ?, ?)',
    product.id,
    type,
    oldPrice,
    newPrice,
    now
  );
}

// The latest changes, newest first, with the product's name and link.
async function listRecentChanges(limit) {
  const db = await getDb();
  return db.all(
    `SELECT c.*, p.title, p.brand, p.url
     FROM changes c JOIN products p ON p.id = c.product_id
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ?`,
    limit
  );
}

module.exports = { insertChange, listRecentChanges };
