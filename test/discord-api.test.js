// Sending and deleting Discord messages, against a local stand-in for
// Discord's webhook API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

// Before requiring the app: these are read when it loads.
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'matsmart-discord-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/test';

const { deleteMessage, sendMessage } = require('../src/notify/discord');
const { deleteSentMessages } = require('../src/notify/sent-messages');
const { countDiscordMessages, listDiscordMessageIds, saveDiscordMessage } = require('../src/db/discord-messages');

// The stand-in: messages by id, every request logged. `next` can make the
// next DELETE answer with a given status first.
const discord = { messages: new Set(), requests: [], next: [] };
let webhookUrl;
let server;

test.before(async () => {
  let lastId = 100;
  server = http.createServer((req, res) => {
    discord.requests.push(`${req.method} ${req.url}`);
    if (req.method === 'POST') {
      lastId += 1;
      discord.messages.add(String(lastId));
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: String(lastId) }));
    }
    const forced = discord.next.shift();
    if (forced === 429) {
      res.writeHead(429, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ message: 'You are being rate limited.', retry_after: 0.05 }));
    }
    if (forced) {
      res.writeHead(forced);
      return res.end('broken');
    }
    const id = req.url.split('/messages/')[1];
    if (!discord.messages.delete(id)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Unknown Message', code: 10008 }));
    }
    res.writeHead(204);
    return res.end();
  });
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  webhookUrl = `http://127.0.0.1:${server.address().port}/api/webhooks/1/token`;
});

test.after(() => server.close());

test('sending waits for the message and returns its id', async () => {
  const id = await sendMessage(webhookUrl, { content: 'hej' });
  assert.equal(id, '101');
  assert.equal(discord.requests.at(-1), 'POST /api/webhooks/1/token?wait=true');
});

test('deleting: deleted, then gone', async () => {
  assert.equal(await deleteMessage(webhookUrl, '101'), 'deleted');
  assert.equal(discord.requests.at(-1), 'DELETE /api/webhooks/1/token/messages/101');
  assert.equal(await deleteMessage(webhookUrl, '101'), 'gone');
});

test('a rate limit is waited out', async () => {
  const id = await sendMessage(webhookUrl, { content: 'hej' });
  discord.next.push(429);
  assert.equal(await deleteMessage(webhookUrl, id), 'deleted');
});

test('deleting every sent message: done ones are forgotten, gone ones counted', async () => {
  for (let i = 0; i < 3; i += 1) await saveDiscordMessage(await sendMessage(webhookUrl, { content: 'hej' }));
  // One deleted by hand in Discord.
  discord.messages.delete((await listDiscordMessageIds())[1]);
  assert.deepEqual(await deleteSentMessages(webhookUrl, { pauseMs: 0 }), { deleted: 2, gone: 1 });
  assert.equal(await countDiscordMessages(), 0);
  assert.equal(discord.messages.size, 0);
});

test('an error stops it, keeping what is left for next time', async () => {
  for (let i = 0; i < 3; i += 1) await saveDiscordMessage(await sendMessage(webhookUrl, { content: 'hej' }));
  discord.next.push(undefined, 500);
  await assert.rejects(deleteSentMessages(webhookUrl, { pauseMs: 0 }), (err) => {
    assert.match(err.message, /Discord svarade 500/);
    assert.deepEqual(err.progress, { deleted: 1, gone: 0 });
    return true;
  });
  assert.equal(await countDiscordMessages(), 2);
  assert.deepEqual(await deleteSentMessages(webhookUrl, { pauseMs: 0 }), { deleted: 2, gone: 0 });
});
