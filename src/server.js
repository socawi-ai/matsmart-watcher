const { loadEnvFile } = require('./load-env');

loadEnvFile();

const bcrypt = require('bcryptjs');

// Reading the config throws on a missing or invalid setting, before
// anything else starts.
const { APP_NAME, config } = require('./config');
const app = require('./app');
const { countUsers, createUser, getDb } = require('./db');
const { startScheduler } = require('./scheduler');

// The account is created on first start, from DEFAULT_ADMIN_USERNAME and
// DEFAULT_ADMIN_PASSWORD. Later starts leave it alone.
async function createFirstAccount() {
  if ((await countUsers()) > 0) return;
  if (!config.adminPassword) {
    throw new Error('Inget konto finns ännu: sätt DEFAULT_ADMIN_PASSWORD (se .env.example).');
  }
  await createUser({ username: config.adminUsername, passwordHash: await bcrypt.hash(config.adminPassword, 12) });
  console.log(`Kontot "${config.adminUsername}" har skapats.`);
}

async function start() {
  // Opening the database runs any pending migrations. Do it before accepting
  // requests, so a failed migration stops the app instead of serving
  // half-migrated data.
  await getDb();
  await createFirstAccount();

  app.listen(config.port, () => {
    console.log(`${APP_NAME} körs på http://localhost:${config.port}, kontrollerar var ${config.checkIntervalMinutes}:e minut.`);
    startScheduler();
  });
}

start().catch((err) => {
  console.error(`${APP_NAME} kunde inte starta:`, err.message);
  process.exit(1);
});
