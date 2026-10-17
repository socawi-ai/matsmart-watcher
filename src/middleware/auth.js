const { findUserById } = require('../db');

async function attachUser(req, _res, next) {
  const userId = req.session && req.session.userId;
  req.currentUser = userId ? (await findUserById(userId)) || null : null;
  return next();
}

function requireAuth(req, res, next) {
  if (req.currentUser) {
    return next();
  }
  return res.redirect('/auth/login');
}

module.exports = { attachUser, requireAuth };
