// Admin form posts redirect back (post/redirect/get); the outcome is stored
// in the session and shown once on the next page view.
function finish(req, res, type, message, to) {
  req.session.flash = { type, message };
  return res.redirect(to);
}

// The flash to show on this view, if any (it's shown only once).
function takeFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

module.exports = { finish, takeFlash };
