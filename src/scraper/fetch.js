// HTTP only. Requests go one at a time with at least REQUEST_DELAY_MS
// between them, under a User-Agent that says what's asking.
const USER_AGENT = 'matsmart-watcher/0.1 (personal stock watcher)';
const REQUEST_DELAY_MS = 2000;
const TIMEOUT_MS = 30000;

let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The response's status and body. Redirects aren't followed: a page that
// moved shows up as its 3xx status.
async function fetchText(url) {
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  return { status: res.status, location: res.headers.get('location'), text: await res.text() };
}

module.exports = { fetchText };
