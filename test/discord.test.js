const test = require('node:test');
const assert = require('node:assert/strict');

const { MAX_EMBEDS, buildMessage } = require('../src/notify/discord');
const { kr, stockNote } = require('../src/format');

const product = {
  id: 'a',
  title: 'Proteinbar Toffee Delight 15-pack',
  brand: 'Gainomax',
  url: 'https://www.matsmart.se/produkt/gainomax-proteinbar-toffee-delight-15-pack',
  image: 'https://productimages.motatos.com/x.png',
  price: 19900,
  originalPrice: 36900,
  stock: 12,
  bestBefore: '2027-07-16',
  inStock: true
};

test('prices are written in kronor', () => {
  assert.equal(kr(24900), '249 kr');
  assert.equal(kr(2490), '24,90 kr');
});

test('stock notes', () => {
  assert.equal(stockNote(product), '12 kvar');
  assert.equal(stockNote({ ...product, stock: 101 }), 'Över 100 kvar');
  assert.equal(stockNote({ ...product, inStock: false }), 'Slutsåld');
});

test('a price drop as an embed: name, old → new price, best before, stock, link', () => {
  const message = buildMessage([{ type: 'price_drop', product, oldPrice: 24900, newPrice: 19900 }]);
  assert.equal(message.content, '**1 förändring på Matsmart**');
  assert.deepEqual(message.embeds, [
    {
      title: 'Prissänkning: Proteinbar Toffee Delight 15-pack',
      url: product.url,
      color: 0x16a34a,
      description: 'Gainomax',
      fields: [
        { name: 'Pris', value: '249 kr → 199 kr', inline: true },
        { name: 'Ordinarie pris', value: '369 kr (−46 %)', inline: true },
        { name: 'Bäst före', value: '2027-07-16', inline: true },
        { name: 'Lager', value: '12 kvar', inline: true }
      ],
      thumbnail: { url: product.image }
    }
  ]);
});

test('more changes than Discord takes: the first ten, and a note', () => {
  const changes = Array.from({ length: 12 }, () => ({ type: 'new', product, oldPrice: null, newPrice: 19900 }));
  const message = buildMessage(changes);
  assert.equal(message.embeds.length, MAX_EMBEDS);
  assert.equal(message.content, '**12 förändringar på Matsmart** – visar 10, resten finns under Historik.');
  assert.equal(message.embeds[0].fields[0].value, '199 kr');
});
