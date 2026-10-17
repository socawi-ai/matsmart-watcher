// Runs a check every CHECK_INTERVAL_MINUTES, and on demand ("Kontrollera
// nu"). Only one check runs at a time.
const { config } = require('./config');
const { runCheck } = require('./check');
const { scrapeWatch } = require('./scraper/source');
const { buildMessage, sendMessage } = require('./notify/discord');
const { changesToSend, getNotifySettings } = require('./notify/settings');
const { saveDiscordMessage } = require('./db/discord-messages');

// Sends what the notification settings allow, and remembers the message so
// it can be deleted from Inställningar; returns how many changes it sent.
async function notify(changes) {
  const toSend = changesToSend(changes, await getNotifySettings());
  if (toSend.length) {
    await saveDiscordMessage(await sendMessage(config.discordWebhookUrl, buildMessage(toSend)));
  }
  return toSend.length;
}

let running = false;
// { startedAt, finishedAt, result } or { startedAt, finishedAt, error }
let lastRun = null;

// Starts a check unless one is running. Returns whether it started.
function checkNow() {
  if (running) return false;
  running = true;
  const startedAt = new Date().toISOString();
  console.log('Kontroll startad.');
  runCheck({ scrapeWatch, notify })
    .then((result) => {
      lastRun = { startedAt, finishedAt: new Date().toISOString(), result };
      console.log(
        `Kontroll klar: ${result.watches} bevakningar (${result.failed} misslyckades), ` +
          `${result.products} produkter, ${result.changes} förändringar, ${result.sent} skickade till Discord.`
      );
    })
    .catch((err) => {
      lastRun = { startedAt, finishedAt: new Date().toISOString(), error: err.message };
      console.error('Kontrollen misslyckades:', err);
    })
    .finally(() => {
      running = false;
    });
  return true;
}

function startScheduler() {
  checkNow();
  setInterval(checkNow, config.checkIntervalMinutes * 60 * 1000);
}

const checkStatus = () => ({ running, lastRun });

module.exports = { checkNow, checkStatus, startScheduler };
