const express = require('express');
const bcrypt = require('bcryptjs');

const { findUserByUsername } = require('../db');
const loginRateLimiter = require('../middleware/login-rate-limit');
const { secret, text } = require('../utils/input');
const { SESSION_COOKIE } = require('../config');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.currentUser) {
    return res.redirect('/');
  }
  return res.render('login', { error: null });
});

router.post('/login', loginRateLimiter, async (req, res, next) => {
  const body = req.body || {};
  const username = text(body.username).toLowerCase();
  const password = secret(body.password);

  if (!username || !password) {
    return res.status(400).render('login', { error: 'Användarnamn och lösenord måste fyllas i.' });
  }

  const user = await findUserByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).render('login', { error: 'Ogiltiga inloggningsuppgifter.' });
  }

  // New session id on login, so an id planted before login (session
  // fixation) is worthless afterwards.
  return req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    return res.redirect('/');
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(SESSION_COOKIE);
    return res.redirect('/auth/login');
  });
});

module.exports = router;
