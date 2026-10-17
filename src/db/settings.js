// Settings changed in the app, as text by key.
const { getDb } = require('./index');
const { inTransaction } = require('./transaction');

// Saved settings by key ({ key: value }); keys that were never saved are left out.
async function getSettings(keys) {
  const db = await getDb();
  const rows = await db.all(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(', ')})`, ...keys);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

// Saves several settings at once ({ key: value }).
async function saveSettings(values) {
  const now = new Date().toISOString();
  await inTransaction(async (db) => {
    for (const [key, value] of Object.entries(values)) {
      await db.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        key,
        String(value),
        now
      );
    }
  });
}

module.exports = { getSettings, saveSettings };
