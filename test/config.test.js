// The app refuses to start without its required settings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// config.js reads the environment when it loads.
process.env.SESSION_SECRET = 'test-secret';
process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/test';
const { trustProxySetting } = require('../src/config');

const VALID = {
  SESSION_SECRET: 'secret',
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/abc',
  DEFAULT_ADMIN_PASSWORD: 'password'
};

// Starts the server in a fresh process with only the given variables, and
// returns its exit code and output. Each case here stops before listening.
function start(env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matsmart-config-'));
  return spawnSync(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    // Every variable is set (if only to ''), so a local .env can't fill one
    // in: load-env never overrides a variable that's set.
    env: {
      PATH: process.env.PATH,
      APP_DATA_DIR: dataDir,
      SESSION_SECRET: '',
      DISCORD_WEBHOOK_URL: '',
      DEFAULT_ADMIN_PASSWORD: '',
      CHECK_INTERVAL_MINUTES: '',
      ...env
    },
    encoding: 'utf8',
    timeout: 10000
  });
}

test('a missing required variable stops the app, naming it', () => {
  for (const name of ['SESSION_SECRET', 'DISCORD_WEBHOOK_URL']) {
    const result = start({ ...VALID, [name]: '' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${name} måste vara satt`));
  }
});

test('invalid values stop the app', () => {
  let result = start({ ...VALID, DISCORD_WEBHOOK_URL: 'https://example.com/hook' });
  assert.match(result.stderr, /DISCORD_WEBHOOK_URL måste vara en Discord-webhook/);
  result = start({ ...VALID, CHECK_INTERVAL_MINUTES: 'ofta' });
  assert.match(result.stderr, /CHECK_INTERVAL_MINUTES måste vara ett heltal/);
});

test('without an account, DEFAULT_ADMIN_PASSWORD is required', () => {
  const result = start({ ...VALID, DEFAULT_ADMIN_PASSWORD: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sätt DEFAULT_ADMIN_PASSWORD/);
});

test('X-Forwarded-For is only trusted behind a proxy', () => {
  assert.equal(trustProxySetting('', false), false);
  assert.equal(trustProxySetting('', true), 1);
  assert.equal(trustProxySetting('false', true), false);
  assert.equal(trustProxySetting('2', false), 2);
  assert.equal(trustProxySetting('loopback', false), 'loopback');
});
