// The watchlist: list, add and remove watches.
const express = require('express');

const { createWatch, deleteWatch, findWatchById, listWatches } = require('../db/watches');
const { readWatchPath } = require('../matsmart');
const { finish } = require('./flash');
const { LIMITS, text } = require('../utils/input');

const router = express.Router();

const fail = (req, res, message) => finish(req, res, 'error', message, '/');
const done = (req, res, message) => finish(req, res, 'success', message, '/');

const describe = (watch) => (watch.keyword ? `${watch.path} (”${watch.keyword}”)` : watch.path);

router.get('/', async (req, res) => {
  res.render('watches', { watches: await listWatches(), limits: LIMITS });
});

router.post('/watches', async (req, res) => {
  const body = req.body || {};
  const url = text(body.url);
  const keyword = text(body.keyword);

  if (!url) return fail(req, res, 'Fyll i en adress på matsmart.se.');
  if (url.length > LIMITS.url) return fail(req, res, `Adressen får vara högst ${LIMITS.url} tecken.`);
  if (keyword.length > LIMITS.keyword) return fail(req, res, `Nyckelordet får vara högst ${LIMITS.keyword} tecken.`);
  const { path, error } = readWatchPath(url);
  if (error) return fail(req, res, error);

  const watch = { path, keyword };
  if (!(await createWatch(watch))) return fail(req, res, `${describe(watch)} bevakas redan.`);
  return done(req, res, `${describe(watch)} bevakas nu. Den kontrolleras vid nästa kontroll.`);
});

router.post('/watches/:id/delete', async (req, res) => {
  const watch = await findWatchById(Number(req.params.id));
  if (!watch) return fail(req, res, 'Bevakningen finns inte.');
  await deleteWatch(watch.id);
  return done(req, res, `${describe(watch)} bevakas inte längre.`);
});

module.exports = router;
