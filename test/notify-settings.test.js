// Which changes go to Discord, and the settings stored for it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Before requiring the app: these are read when it loads.
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'matsmart-notify-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/test';

const {
  CHANGE_TYPES,
  changesToSend,
  getNotifySettings,
  readNotifySettingsForm,
  saveNotifySettings
} = require('../src/notify/settings');

const change = (type, firstCheck = false) => ({ type, firstCheck });
const all = { types: CHANGE_TYPES, firstCheck: true, paused: false };

test('by default everything is sent', async () => {
  assert.deepEqual(await getNotifySettings(), all);
  const changes = CHANGE_TYPES.map((type) => change(type));
  assert.deepEqual(changesToSend(changes, all), changes);
});

test('only the chosen types are sent', () => {
  const changes = [change('new'), change('price_drop'), change('price_up')];
  assert.deepEqual(changesToSend(changes, { ...all, types: ['price_drop'] }), [change('price_drop')]);
});

test('first checks: new products from them can be left out', () => {
  const changes = [change('new', true), change('new'), change('price_drop')];
  assert.deepEqual(changesToSend(changes, { ...all, firstCheck: false }), [change('new'), change('price_drop')]);
});

test('paused: nothing is sent', () => {
  assert.deepEqual(changesToSend([change('new'), change('sold_out')], { ...all, paused: true }), []);
});

test('settings are saved and read back', async () => {
  await saveNotifySettings({ types: ['back_in_stock', 'price_drop'], firstCheck: false, paused: true });
  assert.deepEqual(await getNotifySettings(), { types: ['back_in_stock', 'price_drop'], firstCheck: false, paused: true });
  // No types at all is a choice too.
  await saveNotifySettings({ types: [], firstCheck: true, paused: false });
  assert.deepEqual(await getNotifySettings(), { types: [], firstCheck: true, paused: false });
});

test('the settings form', () => {
  assert.deepEqual(readNotifySettingsForm({ types: ['price_drop', 'new'], firstCheck: '1' }), {
    settings: { types: ['new', 'price_drop'], firstCheck: true, paused: false }
  });
  // One checkbox ticked arrives as text, none as nothing.
  assert.deepEqual(readNotifySettingsForm({ types: 'sold_out', paused: '1' }).settings, {
    types: ['sold_out'],
    firstCheck: false,
    paused: true
  });
  assert.deepEqual(readNotifySettingsForm({}).settings.types, []);
  assert.match(readNotifySettingsForm({ types: ['new', 'cheap'] }).error, /Okänd typ av förändring: cheap/);
});
