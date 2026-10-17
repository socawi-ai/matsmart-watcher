// Every setting the app takes from the environment, read once when this
// module loads (after .env, see load-env.js). A missing or invalid value
// stops the app with a message naming the variable.
const path = require('path');

const APP_NAME = 'Matsmart watcher';
const SESSION_COOKIE = 'matsmart-watcher.sid';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} måste vara satt (se .env.example).`);
  }
  return value;
}

function positiveInteger(name, defaultValue) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return defaultValue;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new Error(`${name} måste vara ett heltal större än 0, inte "${raw}".`);
  }
  return Number(raw);
}

function discordWebhookUrl(name) {
  const value = required(name);
  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\S+$/.test(value)) {
    throw new Error(`${name} måste vara en Discord-webhook (https://discord.com/api/webhooks/…).`);
  }
  return value;
}

// Express's "trust proxy": a number of hops ("1"), "false", or addresses
// ("loopback"). Empty: one hop when COOKIE_SECURE says there's an HTTPS
// proxy in front, none otherwise. It decides req.ip for the login limit, so
// only trust a proxy if the app can't be reached around it.
function trustProxySetting(raw, behindHttpsProxy) {
  const value = String(raw || '').trim();
  if (!value) return behindHttpsProxy ? 1 : false;
  if (/^(false|0|no|off)$/i.test(value)) return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

const cookieSecure = process.env.COOKIE_SECURE === 'true';

const config = Object.freeze({
  port: positiveInteger('PORT', 3000),
  // APP_DATA_DIR lets tests point the app at another directory.
  dataDir: process.env.APP_DATA_DIR || path.join(__dirname, '..', 'data'),
  sessionSecret: required('SESSION_SECRET'),
  cookieSecure,
  trustProxy: trustProxySetting(process.env.TRUST_PROXY, cookieSecure),
  // Only used on first start, to create the account (see server.js).
  adminUsername: String(process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim().toLowerCase(),
  adminPassword: process.env.DEFAULT_ADMIN_PASSWORD || '',
  discordWebhookUrl: discordWebhookUrl('DISCORD_WEBHOOK_URL'),
  checkIntervalMinutes: positiveInteger('CHECK_INTERVAL_MINUTES', 30)
});

module.exports = { APP_NAME, SESSION_COOKIE, config, trustProxySetting };
