// Inställningar: what goes to Discord.
const express = require('express');

const { config } = require('../config');
const { CHANGE_LABELS } = require('../format');
const { countDiscordMessages } = require('../db/discord-messages');
const { deleteSentMessages } = require('../notify/sent-messages');
const { CHANGE_TYPES, getNotifySettings, readNotifySettingsForm, saveNotifySettings } = require('../notify/settings');
const { finish } = require('./flash');

const router = express.Router();

router.get('/', async (req, res) => {
  res.render('settings', {
    settings: await getNotifySettings(),
    changeTypes: CHANGE_TYPES,
    labels: CHANGE_LABELS,
    sentMessages: await countDiscordMessages()
  });
});

router.post('/', async (req, res) => {
  const { settings, error } = readNotifySettingsForm(req.body || {});
  if (error) return finish(req, res, 'error', `Inställningarna sparades inte. ${error}`, '/settings');
  await saveNotifySettings(settings);
  return finish(req, res, 'success', 'Inställningarna har sparats.', '/settings');
});

// Deletes every message the app has sent to Discord. One at a time, so the
// page answers when it's done (about two a second).
let deleting = false;

const describeProgress = ({ deleted, gone }) =>
  `${deleted} borttagna${gone ? `, ${gone} fanns inte längre i Discord` : ''}`;

router.post('/discord-messages/delete', async (req, res) => {
  const back = (type, message) => finish(req, res, type, message, '/settings#skickade');
  if ((req.body || {}).confirm !== '1') return back('error', 'Kryssa i ”Ja, ta bort” först.');
  if (deleting) return back('error', 'Borttagningen pågår redan.');
  deleting = true;
  try {
    const progress = await deleteSentMessages(config.discordWebhookUrl);
    return back('success', `Skickade notiser: ${describeProgress(progress)}.`);
  } catch (err) {
    console.error('Borttagningen av Discord-meddelanden stoppades:', err.message);
    return back('error', `Borttagningen stoppades (${describeProgress(err.progress)} innan dess): ${err.message}`);
  } finally {
    deleting = false;
  }
});

module.exports = router;
