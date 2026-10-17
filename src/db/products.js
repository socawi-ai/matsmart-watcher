// The last known state of each product. Rows are turned into the same
// product objects the parser makes (src/scraper/parse.js).
const { getDb } = require('./index');

const fromRow = (row) => ({
  id: row.id,
  title: row.title,
  brand: row.brand,
  url: row.url,
  image: row.image,
  price: row.price,
  originalPrice: row.original_price,
  stock: row.stock,
  bestBefore: row.best_before,
  inStock: row.in_stock === 1
});

// Every stored product by id, inside a check's transaction.
async function mapAllProducts(db) {
  const rows = await db.all('SELECT * FROM products');
  return new Map(rows.map((row) => [row.id, fromRow(row)]));
}

async function saveProduct(db, product, now) {
  await db.run(
    `INSERT INTO products (id, title, brand, url, image, price, original_price, stock, best_before, in_stock, first_seen_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       title = excluded.title, brand = excluded.brand, url = excluded.url, image = excluded.image,
       price = excluded.price, original_price = excluded.original_price, stock = excluded.stock,
       best_before = excluded.best_before, in_stock = excluded.in_stock, updated_at = excluded.updated_at`,
    product.id,
    product.title,
    product.brand,
    product.url,
    product.image,
    product.price,
    product.originalPrice,
    product.stock,
    product.bestBefore,
    product.inStock ? 1 : 0,
    now,
    now
  );
}

async function markSoldOut(db, productId, now) {
  await db.run('UPDATE products SET in_stock = 0, updated_at = ? WHERE id = ?', now, productId);
}

// How the products page can be sorted, by the word in ?sort=.
const SORTS = {
  discount: '(original_price - price) * 1.0 / original_price DESC, title',
  price: 'price, title',
  best_before: 'best_before IS NULL, best_before, title',
  name: 'title'
};

// Products in stock that a watch found in its last check.
async function listInStockProducts(sort) {
  const db = await getDb();
  const rows = await db.all(`
    SELECT * FROM products
    WHERE in_stock = 1 AND id IN (SELECT product_id FROM watch_products)
    ORDER BY ${SORTS[sort]}
  `);
  return rows.map(fromRow);
}

module.exports = { SORTS, listInStockProducts, mapAllProducts, markSoldOut, saveProduct };
