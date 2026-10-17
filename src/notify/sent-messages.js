// Deleting the Discord messages the app has sent, from the Inställningar page.
const { deleteMessage } = require('./discord');
const { forgetDiscordMessage, listDiscordMessageIds } = require('../db/discord-messages');

const PAUSE_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Deletes every stored message, one at a time; each is forgotten as soon as
// it's done, so a stop halfway keeps the rest for next time.
// Returns { deleted, gone } (gone: Discord no longer had it). An error stops
// it, with what was done so far in err.progress.
async function deleteSentMessages(webhookUrl, { pauseMs = PAUSE_MS } = {}) {
  const progress = { deleted: 0, gone: 0 };
  for (const id of await listDiscordMessageIds()) {
    try {
      progress[await deleteMessage(webhookUrl, id)] += 1;
    } catch (err) {
      err.progress = progress;
      throw err;
    }
    await forgetDiscordMessage(id);
    await sleep(pauseMs);
  }
  return progress;
}

module.exports = { deleteSentMessages };
