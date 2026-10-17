// Each migration runs once, in order, inside a transaction. The database's
// PRAGMA user_version records how many have been applied, so restarting the
// app (or upgrading the Docker image) never repeats one.
//
// To change the schema, append { name, up(db) } to MIGRATIONS. Never edit,
// remove or reorder one that has shipped: they're one-way on existing data.
const MIGRATIONS = [
  {
    name: 'Grundschema: konton, bevakningar, produkter och förändringar',
    up: (db) =>
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- A matsmart.se page (path only, e.g. /kategori/proteinbars) plus an
        -- optional keyword that product names must contain.
        CREATE TABLE watches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL,
          keyword TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          -- When the watch was last checked without errors (NULL: never).
          checked_at TEXT,
          -- The last check's error, NULL when it worked.
          error TEXT,
          UNIQUE (path, keyword)
        );

        -- The last known state of every product any watch has found.
        -- Prices are in öre.
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          brand TEXT NOT NULL,
          url TEXT NOT NULL,
          image TEXT,
          price INTEGER NOT NULL,
          original_price INTEGER NOT NULL,
          stock INTEGER NOT NULL,
          best_before TEXT,
          in_stock INTEGER NOT NULL CHECK (in_stock IN (0, 1)),
          first_seen_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Which products each watch found in its last successful check.
        CREATE TABLE watch_products (
          watch_id INTEGER NOT NULL REFERENCES watches (id) ON DELETE CASCADE,
          product_id TEXT NOT NULL REFERENCES products (id),
          PRIMARY KEY (watch_id, product_id)
        );

        CREATE TABLE changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id TEXT NOT NULL REFERENCES products (id),
          type TEXT NOT NULL CHECK (type IN ('new', 'back_in_stock', 'sold_out', 'price_drop', 'price_up')),
          old_price INTEGER,
          new_price INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX changes_by_time ON changes (created_at DESC, id DESC);
      `)
  }
];

async function runMigrations(db, migrations = MIGRATIONS) {
  const { user_version: currentVersion } = await db.get('PRAGMA user_version');

  for (let version = currentVersion; version < migrations.length; version += 1) {
    const migration = migrations[version];

    await db.exec('BEGIN IMMEDIATE');
    try {
      await migration.up(db);
      await db.exec(`PRAGMA user_version = ${version + 1}`);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw new Error(`Databasmigrering ${version + 1} misslyckades (${migration.name}): ${err.message}`, {
        cause: err
      });
    }
  }
}

module.exports = { MIGRATIONS, runMigrations };
