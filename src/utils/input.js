// Reading form fields safely. Express parses `name[]=a&name[]=b` into an
// array and `name[x]=1` into an object, so a field can be anything; these
// helpers only accept plain text.

// Maximum lengths (characters) for text fields.
const LIMITS = {
  username: 64,
  password: 200,
  url: 500,
  keyword: 100
};

// The field as trimmed text, or '' when it's missing or not text.
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A password field: text as typed (spaces may be intentional), or ''.
function secret(value) {
  return typeof value === 'string' ? value : '';
}

module.exports = { LIMITS, secret, text };
