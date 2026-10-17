// Change events → one Discord message, sent through a webhook.
const { CHANGE_LABELS, discountPercent, kr, priceChange, stockNote } = require('../format');

// Discord takes at most 10 embeds per message.
const MAX_EMBEDS = 10;

const COLORS = {
  new: 0x2563eb,
  back_in_stock: 0x16a34a,
  sold_out: 0x6b7280,
  price_drop: 0x16a34a,
  price_up: 0xdc2626
};

function embedFor({ type, product, oldPrice, newPrice }) {
  return {
    title: `${CHANGE_LABELS[type]}: ${product.title}`.slice(0, 256),
    url: product.url,
    color: COLORS[type],
    description: product.brand,
    fields: [
      { name: 'Pris', value: priceChange(oldPrice, newPrice), inline: true },
      {
        name: 'Ordinarie pris',
        value: `${kr(product.originalPrice)} (−${discountPercent({ ...product, price: newPrice })} %)`,
        inline: true
      },
      { name: 'Bäst före', value: product.bestBefore || '–', inline: true },
      { name: 'Lager', value: stockNote(product), inline: true }
    ],
    ...(product.image ? { thumbnail: { url: product.image } } : {})
  };
}

// The message for a check's changes (at least one).
function buildMessage(changes) {
  const shown = changes.slice(0, MAX_EMBEDS);
  const more = changes.length - shown.length;
  const count = changes.length === 1 ? '1 förändring' : `${changes.length} förändringar`;
  return {
    username: 'Matsmart watcher',
    content: `**${count} på Matsmart**${more ? ` – visar ${shown.length}, resten finns under Historik.` : ''}`,
    embeds: shown.map(embedFor)
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function failure(res) {
  return new Error(`Discord svarade ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// Sends the message and returns its id. wait=true makes Discord answer with
// the message, which is the only way to learn the id (needed to delete it).
async function sendMessage(webhookUrl, message) {
  const url = new URL(webhookUrl);
  url.searchParams.set('wait', 'true');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()).id;
}

// Deletes a message the webhook sent. Returns 'deleted', or 'gone' when
// Discord doesn't know it (deleted by hand, or sent through another
// webhook). When rate limited, waits as long as Discord asks and tries again.
async function deleteMessage(webhookUrl, messageId) {
  const url = new URL(webhookUrl);
  url.pathname += `/messages/${encodeURIComponent(messageId)}`;
  for (;;) {
    const res = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(30000) });
    if (res.status === 204) return 'deleted';
    if (res.status === 404) return 'gone';
    if (res.status !== 429) throw await failure(res);
    const { retry_after: retryAfter } = await res.json();
    await sleep(Math.ceil(retryAfter * 1000));
  }
}

module.exports = { MAX_EMBEDS, buildMessage, deleteMessage, sendMessage };
