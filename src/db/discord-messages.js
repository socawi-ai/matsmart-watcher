// The Discord messages the app has sent (their ids), oldest first.
const { getDb } = require('./index');

async function saveDiscordMessage(id) {
  const db = await getDb();
  await db.run('INSERT INTO discord_messages (id, sent_at) VALUES (?, ?)', id, new Date().toISOString());
}

async function listDiscordMessageIds() {
  const db = await getDb();
  return (await db.all('SELECT id FROM discord_messages ORDER BY sent_at, id')).map((row) => row.id);
}

async function countDiscordMessages() {
  const db = await getDb();
  return (await db.get('SELECT COUNT(*) AS count FROM discord_messages')).count;
}

async function forgetDiscordMessage(id) {
  const db = await getDb();
  await db.run('DELETE FROM discord_messages WHERE id = ?', id);
}

module.exports = { countDiscordMessages, forgetDiscordMessage, listDiscordMessageIds, saveDiscordMessage };
