const express = require('express');
const path = require('path');
const session = require('express-session');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const watchesRouter = require('./routes/watches');
const productsRouter = require('./routes/products');
const historyRouter = require('./routes/history');
const checkRouter = require('./routes/check');
const { takeFlash } = require('./routes/flash');
const { attachUser, requireAuth } = require('./middleware/auth');
const SQLiteSessionStore = require('./db/session-store');
const { APP_NAME, SESSION_COOKIE, config } = require('./config');
const { checkStatus } = require('./scheduler');
const format = require('./format');

// Where the products page loads its thumbnails from.
const PRODUCT_IMAGES_ORIGIN = 'https://productimages.motatos.com';

const app = express();

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use((req, res, next) => {
  // Baseline hardening headers without extra dependencies.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Frame-Options', 'DENY');
  // Everything comes from the app itself, except matsmart's product images.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      `img-src 'self' ${PRODUCT_IMAGES_ORIGIN}`,
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  // Only over HTTPS: on plain HTTP browsers ignore it anyway.
  if (config.cookieSecure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Changes (POST etc.) must come from the app's own pages. Browsers say where
// a request comes from in Sec-Fetch-Site; SameSite cookies already stop other
// sites, but not a sibling subdomain ("same-site"). Requests without the
// header (older browsers, curl) are let through.
app.use((req, res, next) => {
  const site = req.get('Sec-Fetch-Site');
  const changes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (changes && (site === 'cross-site' || site === 'same-site')) {
    return res.status(403).send('Förfrågan kom från en annan webbplats och stoppades.');
  }
  return next();
});

app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new SQLiteSessionStore(),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  })
);
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.currentUser = req.currentUser;
  res.locals.appName = APP_NAME;
  res.locals.currentPath = req.path;
  res.locals.format = format;
  next();
});

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');

app.use('/health', healthRouter);
app.use('/auth', authRouter);

// Everything else needs a login. The pages show private data: keep them out
// of browser caches. Each page shows the last form's outcome once, and how
// the checks are going.
app.use(requireAuth, (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') res.locals.flash = takeFlash(req);
  res.locals.checkStatus = checkStatus();
  next();
});
app.use('/', watchesRouter);
app.use('/products', productsRouter);
app.use('/history', historyRouter);
app.use('/check', checkRouter);

app.use((req, res) => {
  res.status(404).send('Sidan finns inte.');
});

module.exports = app;
