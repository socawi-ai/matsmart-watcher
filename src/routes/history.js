// The latest changes the checks found.
const express = require('express');

const { listRecentChanges } = require('../db/changes');

const router = express.Router();
const SHOWN = 200;

router.get('/', async (req, res) => {
  res.render('history', { changes: await listRecentChanges(SHOWN), shown: SHOWN });
});

module.exports = router;
