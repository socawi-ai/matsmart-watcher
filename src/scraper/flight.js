// Reads the React Server Components ("flight") payload that matsmart.se's
// Next.js pages carry in <script>self.__next_f.push([1,"…"])</script> tags.
//
// Joined, the payload is rows "<hex id>:<value>\n". A text row is
// "<hex id>:T<hex byte length>,<text>" with no newline after it, so its
// length (in UTF-8 bytes) is the only way to find where it ends. Values can
// refer to another row as "$<id>".

const PUSH = /<script>self\.__next_f\.push\((\[1,.*?\])\)<\/script>/gs;

function payloadOf(html) {
  const chunks = [...html.matchAll(PUSH)].map((match) => JSON.parse(match[1])[1]);
  if (!chunks.length) {
    throw new Error('Sidan saknar Next.js-data (self.__next_f).');
  }
  return chunks.join('');
}

// The payload's rows by id: { kind: 'text' | 'other', body }.
function readRows(html) {
  const bytes = Buffer.from(payloadOf(html), 'utf8');
  const rows = new Map();
  let pos = 0;
  while (pos < bytes.length) {
    const colon = bytes.indexOf(':', pos);
    if (colon < 0) throw new Error(`Next.js-datan har en rad utan id vid byte ${pos}.`);
    const id = bytes.toString('utf8', pos, colon);
    const textHeader = /^T([0-9a-f]+),/.exec(bytes.toString('latin1', colon + 1, colon + 20));
    if (textHeader) {
      const start = colon + 1 + textHeader[0].length;
      const end = start + parseInt(textHeader[1], 16);
      rows.set(id, { kind: 'text', body: bytes.toString('utf8', start, end) });
      pos = end;
    } else {
      const newline = bytes.indexOf('\n', colon);
      const end = newline < 0 ? bytes.length : newline;
      rows.set(id, { kind: 'other', body: bytes.toString('utf8', colon + 1, end) });
      pos = end + 1;
    }
  }
  return rows;
}

// Every object in the JSON rows whose text contains `marker`, for which
// `test(object)` is true. Other rows (imports, hints, text) are skipped.
function findObjects(rows, marker, test) {
  const found = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (test(node)) found.push(node);
    Object.values(node).forEach(visit);
  };
  for (const row of rows.values()) {
    if (row.kind === 'other' && /^[[{]/.test(row.body) && row.body.includes(marker)) {
      visit(JSON.parse(row.body));
    }
  }
  return found;
}

// A value that may be a "$<id>" reference to a text row → the text.
function resolveText(rows, value) {
  if (!value.startsWith('$')) return value;
  const row = rows.get(value.slice(1));
  if (!row || row.kind !== 'text') {
    throw new Error(`Next.js-datan hänvisar till rad ${value}, som inte är en textrad.`);
  }
  return row.body;
}

module.exports = { findObjects, readRows, resolveText };
