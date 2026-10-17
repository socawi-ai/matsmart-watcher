const test = require('node:test');
const assert = require('node:assert/strict');

const { isProductPath, matchesKeyword, readWatchPath } = require('../src/matsmart');

test('watch addresses become paths on matsmart.se', () => {
  assert.deepEqual(readWatchPath('https://www.matsmart.se/kategori/proteinbars'), { path: '/kategori/proteinbars' });
  assert.deepEqual(readWatchPath('https://matsmart.se/varumarke/marabou/'), { path: '/varumarke/marabou' });
  assert.deepEqual(readWatchPath('/sista-chansen'), { path: '/sista-chansen' });
  assert.deepEqual(readWatchPath('/produkt/malaco-gott-blandat-familie-guf-2'), {
    path: '/produkt/malaco-gott-blandat-familie-guf-2'
  });
});

test('other addresses are refused', () => {
  assert.match(readWatchPath('https://www.example.com/kategori/x').error, /matsmart\.se/);
  assert.match(readWatchPath('http://www.matsmart.se/kategori/x').error, /matsmart\.se/);
  assert.match(readWatchPath('https://www.matsmart.se/search?q=lakrits').error, /filter eller sökning/);
  assert.match(readWatchPath('https://www.matsmart.se/kategori/x?f_price=over_100').error, /filter/);
  assert.match(readWatchPath('https://www.matsmart.se/').error, /produkt-, kategori-/);
  assert.match(readWatchPath('/a/b/c').error, /produkt-, kategori-/);
});

test('product pages are told apart from lists', () => {
  assert.equal(isProductPath('/produkt/x'), true);
  assert.equal(isProductPath('/kategori/x'), false);
});

test('keywords match name or brand, ignoring case', () => {
  const product = { title: 'Proteinbar Saltlakrits 20-pack', brand: 'S-märke' };
  assert.equal(matchesKeyword(product, ''), true);
  assert.equal(matchesKeyword(product, 'LAKRITS'), true);
  assert.equal(matchesKeyword(product, 's-MÄRKE'), true);
  assert.equal(matchesKeyword(product, 'banan'), false);
});
