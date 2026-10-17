// The watchlist: list, add, edit and remove watches.
const express = require('express');

const { createWatch, deleteWatch, findWatchById, listWatches, updateWatch } = require('../db/watches');
const { readWatchPath } = require('../matsmart');
const { finish } = require('./flash');
const { LIMITS, text } = require('../utils/input');

const router = express.Router();

const fail = (req, res, message) => finish(req, res, 'error', message, '/');
const done = (req, res, message) => finish(req, res, 'success', message, '/');

const describe = (watch) => (watch.keyword ? `${watch.path} (”${watch.keyword}”)` : watch.path);

// The add and edit forms' fields → { watch: { path, keyword } } or { error }.
function readWatchForm(body) {
  const url = text(body.url);
  const keyword = text(body.keyword);
  if (!url) return { error: 'Fyll i en adress på matsmart.se.' };
  if (url.length > LIMITS.url) return { error: `Adressen får vara högst ${LIMITS.url} tecken.` };
  if (keyword.length > LIMITS.keyword) return { error: `Nyckelordet får vara högst ${LIMITS.keyword} tecken.` };
  const { path, error } = readWatchPath(url);
  if (error) return { error };
  return { watch: { path, keyword } };
}

async function loadWatch(req, res, next) {
  req.watch = await findWatchById(Number(req.params.id));
  if (!req.watch) return fail(req, res, 'Bevakningen finns inte.');
  return next();
}

router.get('/', async (req, res) => {
  res.render('watches', { watches: await listWatches(), limits: LIMITS });
});

router.post('/watches', async (req, res) => {
  const { watch, error } = readWatchForm(req.body || {});
  if (error) return fail(req, res, error);
  if (!(await createWatch(watch))) return fail(req, res, `${describe(watch)} bevakas redan.`);
  return done(req, res, `${describe(watch)} bevakas nu. Den kontrolleras vid nästa kontroll.`);
});

router.post('/watches/:id', loadWatch, async (req, res) => {
  const { watch, error } = readWatchForm(req.body || {});
  if (error) return fail(req, res, `${describe(req.watch)} sparades inte. ${error}`);
  if (watch.path === req.watch.path && watch.keyword === req.watch.keyword) {
    return done(req, res, `${describe(watch)} är oförändrad.`);
  }
  if (!(await updateWatch(req.watch.id, watch))) return fail(req, res, `${describe(watch)} bevakas redan.`);
  return done(
    req,
    res,
    `${describe(watch)} har sparats. Den kontrolleras vid nästa kontroll.`
  );
});

router.post('/watches/:id/delete', loadWatch, async (req, res) => {
  await deleteWatch(req.watch.id);
  return done(req, res, `${describe(req.watch)} bevakas inte längre.`);
});

module.exports = router;
