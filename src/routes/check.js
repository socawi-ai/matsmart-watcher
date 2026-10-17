// "Kontrollera nu": starts a check right away, then back to the page the
// button was on.
const express = require('express');

const { checkNow } = require('../scheduler');
const { finish } = require('./flash');
const { text } = require('../utils/input');

const router = express.Router();

// The pages the button is on; anything else goes back to the watchlist.
const PAGES = ['/', '/products', '/history', '/settings'];

router.post('/', (req, res) => {
  const back = PAGES.includes(text((req.body || {}).back)) ? req.body.back : '/';
  return checkNow()
    ? finish(req, res, 'success', 'Kontrollen har startat. Ladda om sidan om en stund.', back)
    : finish(req, res, 'error', 'En kontroll pågår redan.', back);
});

module.exports = router;
