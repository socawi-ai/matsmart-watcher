// Runs a check every CHECK_INTERVAL_MINUTES, and on demand ("Kontrollera
// nu"). Only one check runs at a time.
const { config } = require('./config');
const { runCheck } = require('./check');
const { scrapeWatch } = require('./scraper/source');
const { buildMessage, sendMessage } = require('./notify/discord');

const notify = (changes) => sendMessage(config.discordWebhookUrl, buildMessage(changes));

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
          `${result.products} produkter, ${result.changes} förändringar.`
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
