// What goes to Discord, set on the Inställningar page. Every change is still
// recorded under Historik; these only decide what's sent.
//   types:      change types to send
//   firstCheck: send "new" for products only a watch's first check found
//   paused:     send nothing
const { getSettings, saveSettings } = require('../db/settings');
const { CHANGE_LABELS } = require('../format');

const CHANGE_TYPES = Object.keys(CHANGE_LABELS);

const KEYS = { types: 'notify_types', firstCheck: 'notify_first_check', paused: 'notify_paused' };

// Before anything is saved: send everything.
const DEFAULTS = { types: CHANGE_TYPES, firstCheck: true, paused: false };

async function getNotifySettings() {
  const saved = await getSettings(Object.values(KEYS));
  return {
    types: KEYS.types in saved ? saved[KEYS.types].split(',').filter(Boolean) : DEFAULTS.types,
    firstCheck: KEYS.firstCheck in saved ? saved[KEYS.firstCheck] === '1' : DEFAULTS.firstCheck,
    paused: KEYS.paused in saved ? saved[KEYS.paused] === '1' : DEFAULTS.paused
  };
}

async function saveNotifySettings({ types, firstCheck, paused }) {
  await saveSettings({
    [KEYS.types]: types.join(','),
    [KEYS.firstCheck]: firstCheck ? '1' : '0',
    [KEYS.paused]: paused ? '1' : '0'
  });
}

// The settings form → { settings } or { error }. Checkboxes that are off
// aren't sent at all.
function readNotifySettingsForm(body) {
  const types = [body.types || []].flat();
  const unknown = types.filter((type) => !CHANGE_TYPES.includes(type));
  if (unknown.length) return { error: `Okänd typ av förändring: ${unknown.join(', ')}.` };
  return {
    settings: {
      types: CHANGE_TYPES.filter((type) => types.includes(type)),
      firstCheck: body.firstCheck === '1',
      paused: body.paused === '1'
    }
  };
}

// The changes to send, by the settings.
function changesToSend(changes, settings) {
  if (settings.paused) return [];
  return changes.filter(
    (change) => settings.types.includes(change.type) && (settings.firstCheck || !change.firstCheck)
  );
}

module.exports = { CHANGE_TYPES, changesToSend, getNotifySettings, readNotifySettingsForm, saveNotifySettings };
