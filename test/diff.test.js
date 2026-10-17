const test = require('node:test');
const assert = require('node:assert/strict');

const { productChange, vanishedProductIds } = require('../src/diff');

const product = (overrides) => ({ id: 'a', price: 1000, inStock: true, ...overrides });

test('product changes', () => {
  assert.equal(productChange(undefined, product()), 'new');
  assert.equal(productChange(undefined, product({ inStock: false })), null);
  assert.equal(productChange(product({ inStock: false }), product()), 'back_in_stock');
  assert.equal(productChange(product(), product({ inStock: false })), 'sold_out');
  assert.equal(productChange(product({ inStock: false }), product({ inStock: false, price: 1 })), null);
  assert.equal(productChange(product(), product({ price: 900 })), 'price_drop');
  assert.equal(productChange(product(), product({ price: 1100 })), 'price_up');
  assert.equal(productChange(product(), product()), null);
});

test('back in stock wins over a price change', () => {
  assert.equal(productChange(product({ inStock: false }), product({ price: 500 })), 'back_in_stock');
});

test('vanished products: in stock, found last time, not now', () => {
  const stored = new Map([
    ['a', product({ id: 'a' })],
    ['b', product({ id: 'b' })],
    ['c', product({ id: 'c', inStock: false })]
  ]);
  const linked = new Map([[1, ['a', 'b', 'c']]]);
  assert.deepEqual(vanishedProductIds(stored, linked, new Set(['a']), new Set()), ['b']);
});

test('a failed watch proves nothing about its products', () => {
  const stored = new Map([
    ['a', product({ id: 'a' })],
    ['b', product({ id: 'b' })]
  ]);
  // Watch 1 worked and lost "a"; watch 2 failed and also had "a" and "b".
  const linked = new Map([
    [1, ['a']],
    [2, ['a', 'b']]
  ]);
  assert.deepEqual(vanishedProductIds(stored, linked, new Set(), new Set([2])), []);
});
